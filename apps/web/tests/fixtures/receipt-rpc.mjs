// Local read-only RPC fixture for public SSR browser tests; no secrets or signing methods.
import http from 'node:http';
const hash='1'.repeat(32),privateMarker='PRIVATE_FIXTURE_SECRET';
const orderFor=id=>{
 const match=/^pass-(\d+)-order(?:-([12]))?$/.exec(id);
 const number=Number(match?.[1]),sequence=Number(match?.[2]||0);
 if(![2,7,8,9,12,13].includes(number)||(sequence===2&&number!==13))return null;
 const phase=number===8?'PaymentPending':number===9?'Refunded':'Paid';
 return {order_id:id,token_id:`pass-${number}`,buyer_id:'buyer.testnet',agent_id:'agent.testnet',seller_id:'seller.testnet',price_yocto:'10000000000000000000000',revision:1,request_commitment:'a'.repeat(64),response_commitment:'b'.repeat(64),evidence_commitment:'c'.repeat(64),policy_id:'near-tee-ecdsa-v1',phase,attempt:1,created_at_ns:'1794528000000000000',private_input:privateMarker,result_cipher:privateMarker,...([12,13].includes(number)?{payment_mode:sequence===2?'Manual':'Automatic'}:{}),...(number===13?{max_order_price_yocto:sequence===2?null:'100000000000000000000000'}:{})};
};
const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(req.url==='/health'){res.end(JSON.stringify({fixture:true}));return;}
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>32000){res.writeHead(413);res.end('{}');return;}}
 try{
 const request=JSON.parse(raw);let result;
 if(request.method==='block')result={header:{hash,height:100,timestamp_nanosec:'1794528000000000000'}};
 else if(request.method==='query'&&request.params?.request_type==='view_account'){
  if(request.params.account_id==='unavailable.testnet')throw new Error('FIXTURE_CHAIN_UNAVAILABLE');
  if(request.params.finality!=='final')throw new Error('FIXTURE_EXPECTED_FINAL_BALANCE');
  result={amount:'1234567890123456789012345',locked:'2000000000000000000000000',storage_usage:182,code_hash:hash,block_height:100,block_hash:hash};
 }
 else if(request.method==='query'&&request.params?.request_type==='call_function'){
  const args=JSON.parse(Buffer.from(request.params.args_base64,'base64').toString());
  if(request.params.method_name==='get_order'&&args.order_id==='pass-503-order')throw new Error('FIXTURE_CHAIN_UNAVAILABLE');
  let value;
  if(request.params.method_name==='get_config')value={version:2,agent_modes:true,seller_id:'seller.testnet'};
  else if(request.params.block_id!==hash)throw new Error('FIXTURE_EXPECTED_FIXED_FINAL_BLOCK');
  else if(request.params.method_name==='get_order')value=orderFor(args.order_id);
  else if(request.params.method_name==='get_pass'){
    const order=orderFor(args.token_id+'-order');value=order?{token_id:order.token_id,owner_id:order.token_id==='pass-2'?'teammate.testnet':order.buyer_id,agent_id:order.agent_id,seller_id:order.seller_id,model_id:'Qwen/Qwen3.8-27B',price_yocto:order.price_yocto,authorization_revision:1,expires_at_ns:'1999999999000000000',phase:order.phase==='Paid'?'Completed':order.phase==='Refunded'?'Refunded':'InUse',order_id:order.order_id,storage_credit_yocto:'0',transfer_pending:false,attempt:0,payment_mode:order.token_id==='pass-7'?'Automatic':'Manual',raw_response:privateMarker,...(['pass-12','pass-13'].includes(order.token_id)?{phase:'Refunded',order_id:null,owner_id:'teammate.testnet',budget:{funded_yocto:'30000000000000000000000',available_yocto:'0',reserved_yocto:'0',spent_yocto:'20000000000000000000000',refunded_yocto:'10000000000000000000000',orders_created:2}}:{})}:null;
    if(order?.token_id==='pass-13')value.budget={funded_yocto:'1234500000000000000000000',available_yocto:'0',reserved_yocto:'0',spent_yocto:'20000000000000000000000',refunded_yocto:'1214500000000000000000000',orders_created:2};
  } else throw new Error('FIXTURE_READ_ONLY');
  result={result:[...Buffer.from(JSON.stringify(value))],logs:[],block_height:100,block_hash:hash};
 }else throw new Error('FIXTURE_READ_ONLY');
 res.end(JSON.stringify({jsonrpc:'2.0',id:request.id,result}));
 }catch(error){res.end(JSON.stringify({jsonrpc:'2.0',id:'fixture',error:{code:-32000,message:error.message}}));}
});
server.listen(43216,'127.0.0.1');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
