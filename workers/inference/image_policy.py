"""Caller-owned deployment pins, applied only after quote authentication."""
import asyncio
import hashlib
import json
import struct
from pathlib import Path

import dcap_qvl
from ruamel.yaml import YAML


def policy_identity(policy):
    raw = json.dumps(policy, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return {"id": policy["id"], "sha256": hashlib.sha256(raw).hexdigest()}


def load_policy():
    return json.loads(Path(__file__).with_name("deployment-policy.json").read_text(encoding="utf-8"))


def _parsed(value):
    return json.loads(value) if isinstance(value, str) else value


def _events(log, quoted):
    result, identities = bytes(48), {}
    for event in _parsed(log):
        if event.get("imr") != 3:
            continue
        raw = struct.pack("<I", event["event_type"]) + b":" + event["event"].encode() + b":" + bytes.fromhex(event.get("event_payload") or "")
        digest = hashlib.sha384(raw).digest()
        if event.get("digest") and bytes.fromhex(event["digest"]) != digest:
            raise ValueError("DEPLOYMENT_POLICY_REJECTED")
        result = hashlib.sha384(result + digest).digest()
        if event["event"] in ("instance-id", "app-id"):
            if event["event"] in identities:
                raise ValueError("DEPLOYMENT_POLICY_REJECTED")
            identities[event["event"]] = event["event_payload"]
    if result != bytes.fromhex(quoted):
        raise ValueError("DEPLOYMENT_POLICY_REJECTED")
    return identities


def _images(compose):
    services = YAML(typ="safe", pure=True).load(compose)["services"]
    return {name: config["image"] for name, config in services.items() if "image" in config}


async def verify_deployment(report, nonce, role, policy):
    """Match measured bootstrap config and authenticated recorded model intent.

    This does not establish current execution or model-weight provenance. Image
    build provenance is reviewed separately when approving the fixed policy.
    """
    try:
        app_compose = _parsed(report["info"]["tcb_info"])["app_compose"]
        expected = policy[role]
        if hashlib.sha256(app_compose.encode()).hexdigest() != expected["app_compose_sha256"]:
            raise ValueError("DEPLOYMENT_POLICY_REJECTED")
        images = _images(json.loads(app_compose)["docker_compose_file"])
        if images != expected["images"]:
            raise ValueError("DEPLOYMENT_POLICY_REJECTED")
        if role == "gateway":
            return {"manifest_pin": True, "image_pins": True}
        manager = report["compose_manager_attestation"]
        verified = await asyncio.wait_for(dcap_qvl.get_collateral_and_verify(bytes.fromhex(manager["quote"])), 55)
        q = json.loads(verified.to_json())["report"]["TD10"]
        actions = manager["actions"]
        digest = hashlib.sha256(json.dumps(actions, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).digest()
        expected_config = b"\x01" + hashlib.sha256(app_compose.encode()).digest() + bytes(15)
        if (verified.status != "UpToDate" or bytes.fromhex(q["td_attributes"])[0] & 1
                or manager["nonce"] != nonce or bytes.fromhex(manager["actions_hash"]) != digest
                or bytes.fromhex(q["report_data"]) != digest + bytes.fromhex(nonce)
                or bytes.fromhex(manager["report_data"]) != bytes.fromhex(q["report_data"])
                or bytes.fromhex(q["mr_config_id"]) != expected_config):
            raise ValueError("DEPLOYMENT_POLICY_REJECTED")
        manager_ids = _events(manager["event_log"], q["rt_mr3"])
        parent_ids = {e["event"]: e["event_payload"] for e in _parsed(report["event_log"])
                      if e.get("imr") == 3 and e["event"] in ("instance-id", "app-id")}
        if set(manager_ids) != {"instance-id", "app-id"} or manager_ids != parent_ids:
            raise ValueError("DEPLOYMENT_POLICY_REJECTED")
        started = next(a for a in reversed(actions) if a["action"] == "compose_manager_started")
        if started["image"] != expected["manager_image"]:
            raise ValueError("DEPLOYMENT_POLICY_REJECTED")
        for service, sources in expected["runtime_services"].items():
            action = next(a for a in reversed(actions) if a["action"] in ("compose_up", "compose_down")
                          and service in a.get("services", []))
            if action["action"] != "compose_up" or not any(
                all(action.get(k) == source[k] for k in ("commit", "file", "file_sha256")) for source in sources
            ):
                raise ValueError("DEPLOYMENT_POLICY_REJECTED")
        return {"manifest_pin": True, "image_pins": True, "manager_quote_and_actions": True,
                "recorded_runtime_sources": True}
    except (ValueError, KeyError, TypeError, StopIteration, struct.error):
        raise ValueError("DEPLOYMENT_POLICY_REJECTED") from None
