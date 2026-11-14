"""Private stdin/stdout protocol; never logs prompts, credentials or raw responses."""
import asyncio, base64, hashlib, json, os, secrets, struct, sys, time
from datetime import datetime, timezone
from urllib.parse import quote, urlencode
import dcap_qvl
import requests
from eth_account import Account
from eth_account.messages import encode_defunct
from nras import verify_nras_response
from tls_binding import GatewayConnection, report_identity
from image_policy import load_policy, policy_identity, verify_deployment

MODEL='Qwen/Qwen3.8-27B'
def stamp(): return datetime.now(timezone.utc).isoformat()
def parsed(value): return json.loads(value) if isinstance(value,str) else value

async def verify_report(report, nonce, gpu_required, peer_spki_sha256=None):
    verified=await asyncio.wait_for(dcap_qvl.get_collateral_and_verify(bytes.fromhex(report['intel_quote'])),55)
    q=json.loads(verified.to_json())['report']['TD10']
    data=bytes.fromhex(q['report_data'])
    tcb=parsed(report['info']['tcb_info'])
    measured=bytes(48)
    digests=True
    for e in parsed(report['event_log']):
        if e.get('imr')!=3: continue
        digest=hashlib.sha384(struct.pack('<I',e['event_type'])+b':'+e['event'].encode()+b':'+bytes.fromhex(e.get('event_payload') or '')).digest()
        if e.get('digest') and bytes.fromhex(e['digest'])!=digest: digests=False
        measured=hashlib.sha384(measured+digest).digest()
    identity=bytes.fromhex(report['signing_address'].removeprefix('0x'))
    fingerprint=report.get('tls_cert_fingerprint')
    checks={'tdx_up_to_date':verified.status=='UpToDate','debug_disabled':not bool(bytes.fromhex(q['td_attributes'])[0]&1),'ecdsa_identity':report['signing_algo']=='ecdsa' and len(identity)==20,'signer_bound':data[:32]==report_identity(identity,fingerprint),'nonce_bound':data[32:]==bytes.fromhex(nonce) and report['request_nonce']==nonce,'configuration_bound':bytes.fromhex(q['mr_config_id'])==b'\x01'+hashlib.sha256(tcb['app_compose'].encode()).digest()+bytes(15),'event_digests':digests,'event_measurement':measured==bytes.fromhex(q['rt_mr3'])}
    if peer_spki_sha256 is not None:
        checks['tls_peer_bound']=fingerprint is not None and fingerprint.lower()==peer_spki_sha256.lower()
    gpu_response=None
    if gpu_required:
        payload=parsed(report['nvidia_payload'])
        r=requests.post('https://nras.attestation.nvidia.com/v3/attest/gpu',json=payload,timeout=40);r.raise_for_status();gpu_response=r.json()
        authenticated_gpu=verify_nras_response(gpu_response,nonce)
        checks.update({'gpu_request_nonce':payload['nonce']==nonce,**{'gpu_jwt_'+name:passed for name,passed in authenticated_gpu.items()}})
    if not all(checks.values()): raise ValueError('PREFLIGHT_CHECK_FAILED')
    return {'signing_address':report['signing_address'],'signing_algo':report['signing_algo'],'checks':checks,'verified_at':stamp(),'nras_response':gpu_response,'tls_fingerprint':fingerprint.lower() if fingerprint is not None else None}

def verify_signature(signature, body, response, candidates):
    if signature.get('signature_kind')!='provider_tee' or signature.get('signing_algo')!='ecdsa': raise ValueError('MODEL_SIGNATURE_UNAVAILABLE')
    expected=MODEL+':'+hashlib.sha256(body).hexdigest()+':'+hashlib.sha256(response).hexdigest()
    if signature.get('text')!=expected: raise ValueError('RESPONSE_BYTES_MISMATCH')
    signer=Account.recover_message(encode_defunct(text=expected),signature=signature['signature'])
    matches=[r for r in candidates if r['signing_algo']=='ecdsa' and r['signing_address'].lower()==signer.lower()]
    if len(matches)!=1 or signature.get('signing_address','').lower()!=signer.lower(): raise ValueError('MODEL_SIGNER_MISMATCH')
    return signer

async def execute(payload):
    body=base64.b64decode(payload['request_base64'],validate=True)
    request=json.loads(body)
    if request['model']!=MODEL or request.get('stream') is not False or request.get('max_tokens',0)>1024: raise ValueError('REQUEST_POLICY_MISMATCH')
    key=os.environ.get('NEAR_AI_CLOUD_API_KEY')
    if not key: raise ValueError('PROVIDER_NOT_CONFIGURED')
    with GatewayConnection() as connection:
        return await execute_connected(payload,body,key,connection)


async def execute_connected(payload,body,key,connection):
    headers={'Accept':'application/json','Accept-Encoding':'identity','x-no-aliasing':'true','Authorization':'Bearer '+key}
    preflight={}
    policy=load_policy()
    nonce=secrets.token_hex(32)
    path='/v1/attestation/report?'+urlencode({'nonce':nonce,'signing_algo':'ecdsa','include_tls_fingerprint':'true'})
    response=json.loads(connection.request('GET',path,headers={'Accept':'application/json','Accept-Encoding':'identity'}))
    preflight['gateway']={'nonce':nonce,'observed_at':stamp(),'response':response,'transport':connection.evidence()}
    gateway=await verify_report(response['gateway_attestation'],nonce,False,peer_spki_sha256=connection.fingerprint)
    approved_gateway=await verify_deployment(response['gateway_attestation'],nonce,'gateway',policy)
    connection.authorize(gateway)
    nonce=secrets.token_hex(32)
    path='/v1/attestation/report?'+urlencode({'model':MODEL,'provider':'near','nonce':nonce,'signing_algo':'ecdsa'})
    response=json.loads(connection.request('GET',path,headers=headers))
    preflight['model']={'nonce':nonce,'observed_at':stamp(),'response':response}
    reports=preflight['model']['response'].get('model_attestations',[])
    if not reports: raise ValueError('MODEL_EVIDENCE_UNAVAILABLE')
    models=[];approved_models=[]
    for report in reports:
        if report.get('model_name')!=MODEL: raise ValueError('MODEL_EVIDENCE_MISMATCH')
        models.append(await verify_report(report,preflight['model']['nonce'],True))
        approved_models.append(await verify_deployment(report,preflight['model']['nonce'],'model',policy))
    completion_started=stamp()
    authenticated={**headers,'Authorization':'Bearer '+key,'Content-Type':'application/json'}
    # One attempt only: a timeout may still have incurred provider usage.
    raw=connection.request('POST','/v1/chat/completions',body=body,headers=authenticated,timeout=90)
    completion=json.loads(raw);signature=None
    for attempt in range(5):
        path='/v1/signature/'+quote(completion['id'],safe='')+'?signing_algo=ecdsa'
        candidate=json.loads(connection.request('GET',path,headers=authenticated,timeout=12,allow_pending=True))
        if isinstance(candidate,dict) and candidate.get('signature') and 'error_code' not in candidate: signature=candidate;break
        if attempt<4: time.sleep(2)
    if signature is None: raise ValueError('SIGNATURE_UNAVAILABLE')
    signer=verify_signature(signature,body,raw,models)
    text=completion['choices'][0]['message'].get('content','').strip()
    if text.startswith('```'): text=text.split('\n',1)[1].rsplit('```',1)[0].strip()
    output=json.loads(text)
    if not isinstance(output,dict) or not all(k in output for k in ('item','quantity','requested_by')): raise ValueError('RESULT_FORMAT_INVALID')
    checks=[{'name':'Response bytes match','state':'passed'},{'name':'Model signature matched','state':'passed'},{'name':'Intel TDX preflight','state':'passed'},{'name':'NVIDIA GPU evidence','state':'passed'},{'name':'NRAS JWT signatures and claims','state':'passed'},{'name':'TLS connection binding','state':'passed'},{'name':'Deployment image allowlist','state':'passed'},{'name':'All model image build provenance','state':'not_checked'}]
    scope=['Integrity and matched attested signer do not establish answer accuracy.','The application operator processes plaintext.','Gateway TLS binding covers the inference socket, not the upstream model TLS hop.','Image pins cover measured bootstrap and authenticated recorded Qwen deployment intent, not current execution or weights. Gateway/manager build provenance was verified at policy approval; full model image build provenance is not verified.']
    return {'ok':True,'result':{'output':output,'checks':checks,'scope':scope,'model':MODEL},'artifacts':{'request_base64':payload['request_base64'],'response_base64':base64.b64encode(raw).decode(),'preflight':preflight,'verified_preflight':{'gateway':gateway,'models':models},'deployment_policy':{**policy_identity(policy),'gateway':approved_gateway,'models':approved_models},'completion_started_at':completion_started,'signature':signature,'signer':signer,'usage':completion.get('usage')},'signature_kind':'provider_tee'}

if __name__=='__main__':
    try:
        data=sys.stdin.buffer.read(200000)
        print(json.dumps(asyncio.run(execute(json.loads(data)))))
    except Exception as e:
        code=str(e) if isinstance(e,ValueError) and str(e).replace('_','').isupper() else 'INFERENCE_OR_VERIFICATION_UNAVAILABLE'
        print(json.dumps({'ok':False,'error_code':code}))
        sys.exit(1)
