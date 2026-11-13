"""Buyer-run verification. Never sends the brief/result to a verification endpoint."""
import argparse
import asyncio
import base64
import hashlib
import json
import re
from pathlib import Path

import requests
from inference import MODEL, verify_report, verify_signature

CONTRACT = "proofbill-endpx-2026.testnet"


def commitment(kind, salt, value):
    return hashlib.sha256(b"proofbill:v1:" + kind.encode() + b":" + bytes.fromhex(salt) + value).hexdigest()


def validate_export(bundle, order):
    """Validate exact committed bytes, not the export's claimed check statuses."""
    if not isinstance(order, dict) or order.get("order_id") != bundle.get("order_id"):
        raise ValueError("ORDER_ID_MISMATCH")
    if order.get("phase") not in ("Delivered", "PaymentPending", "Paid", "TransferFailed"):
        raise ValueError("ORDER_HAS_NO_DELIVERY")
    salt = bundle.get("salt", "")
    if not re.fullmatch(r"[a-f0-9]{64}", salt):
        raise ValueError("INVALID_EXPORT_SALT")
    serialized = base64.b64decode(bundle["artifact_serialization_base64"], validate=True)
    artifacts = json.loads(serialized)
    if artifacts != bundle["artifacts"]:
        raise ValueError("ARTIFACT_SERIALIZATION_MISMATCH")
    body = base64.b64decode(artifacts["request_base64"], validate=True)
    response = base64.b64decode(artifacts["response_base64"], validate=True)
    for kind, value in (("request", body), ("response", response), ("evidence", serialized)):
        expected = commitment(kind, salt, value)
        if order.get(kind + "_commitment") != expected or bundle.get(kind + "_commitment") != expected:
            raise ValueError(kind.upper() + "_COMMITMENT_MISMATCH")
    request = json.loads(body)
    if request.get("model") != MODEL or request.get("stream") is not False:
        raise ValueError("REQUEST_POLICY_MISMATCH")
    system = request["messages"][0]
    context = f"Order {order['order_id']}; pass {order['token_id']}; revision {order['revision']}; nonce "
    if system.get("role") != "system" or context not in system.get("content", ""):
        raise ValueError("SIGNED_ORDER_CONTEXT_MISMATCH")
    completion = json.loads(response)
    text = completion["choices"][0]["message"]["content"].strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    if json.loads(text) != bundle["result"]["output"] or bundle["result"]["model"] != MODEL:
        raise ValueError("DISPLAYED_RESULT_MISMATCH")
    return artifacts, body, response


def read_order(order_id):
    if not re.fullmatch(r"pass-[1-9]\d{0,19}-order(?:-[1-9]\d{0,2})?", order_id):
        raise ValueError("INVALID_ORDER_ID")
    args = base64.b64encode(json.dumps({"order_id": order_id}).encode()).decode()
    response = requests.post("https://test.rpc.fastnear.com", json={
        "jsonrpc": "2.0", "id": "buyer-evidence", "method": "query",
        "params": {"request_type": "call_function", "finality": "final", "account_id": CONTRACT,
                   "method_name": "get_order", "args_base64": args},
    }, timeout=25)
    response.raise_for_status()
    result = response.json()["result"]
    return json.loads(bytes(result["result"])), result["block_hash"]


async def verify_export(bundle):
    order, block_hash = read_order(bundle["order_id"])
    artifacts, body, response = validate_export(bundle, order)
    if order.get("policy_id") != "near-tee-ecdsa-v1":
        raise ValueError("UNSUPPORTED_VERIFICATION_POLICY")
    preflight = artifacts["preflight"]
    gateway = preflight["gateway"]
    await verify_report(gateway["response"]["gateway_attestation"], gateway["nonce"], False)
    model = preflight["model"]
    reports = model["response"].get("model_attestations", [])
    if not reports or any(r.get("model_name") != MODEL for r in reports):
        raise ValueError("MODEL_EVIDENCE_MISMATCH")
    checked = [await verify_report(r, model["nonce"], True) for r in reports]
    signer = verify_signature(artifacts["signature"], body, response, checked)
    return {
        "verified": True, "network": "testnet", "contract_id": CONTRACT,
        "order_id": order["order_id"], "buyer_id": order["buyer_id"],
        "finalized_block_hash": block_hash, "signer": signer,
        "checks": ["onchain commitments", "signed order context", "displayed result bytes",
                   "response signature", "Intel TDX preflight", "NVIDIA NRAS HTTPS result"],
        "scope": ["Historical response evidence, not a new inference or current deployment attestation.",
                  "Answer quality is not established. The application operator processes plaintext.",
                  "TLS binding, source-image allowlisting and local NRAS JWT-chain verification are not checked."],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export", type=Path, help="Buyer-authorized private JSON export; keep it out of Git")
    args = parser.parse_args()
    try:
        if args.export.stat().st_size > 8_000_000:
            raise ValueError("EXPORT_TOO_LARGE")
        print(json.dumps(asyncio.run(verify_export(json.loads(args.export.read_text(encoding="utf8"))))))
    except Exception as error:
        code = str(error)
        if not re.fullmatch(r"[A-Z_]{3,100}", code):
            code = "VERIFICATION_UNAVAILABLE"
        print(json.dumps({"verified": False, "error_code": code}))
        raise SystemExit(1)
