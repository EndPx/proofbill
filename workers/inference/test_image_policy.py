import asyncio
import base64
import copy
import hashlib
import json
import struct
import unittest
from unittest.mock import AsyncMock, Mock, patch

from image_policy import policy_identity, verify_deployment
from inference import MODEL, execute


class DeploymentPolicyTests(unittest.TestCase):
    def fixture(self):
        nonce = "22" * 32
        image = "vendor/manager@sha256:" + "a" * 64
        compose = json.dumps({"docker_compose_file": "services:\n  manager:\n    image: " + image + "\n"})
        events = [{"imr": 3, "event_type": 0x08000001, "event": name, "event_payload": value}
                  for name, value in [("app-id", "11" * 20), ("instance-id", "33" * 20)]]
        actions = [{"action": "compose_manager_started", "image": image},
                   {"action": "compose_up", "commit": "b" * 40, "file": "prod/test.yaml",
                    "file_sha256": "c" * 64, "services": ["proxy"]}]
        manager = {"nonce": nonce, "quote": "01", "actions": actions, "event_log": events}
        report = {"info": {"tcb_info": {"app_compose": compose}}, "event_log": events,
                  "compose_manager_attestation": manager}
        config = {"app_compose_sha256": hashlib.sha256(compose.encode()).hexdigest(), "images": {"manager": image},
                  "manager_image": image, "runtime_services": {"proxy": [{k: actions[1][k] for k in ("commit", "file", "file_sha256")} ]}}
        return report, {"id": "fixture-policy", "gateway": config, "model": config}, nonce

    def quote(self, report):
        manager = report["compose_manager_attestation"]
        digest = hashlib.sha256(json.dumps(manager["actions"], sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).digest()
        manager["actions_hash"] = digest.hex()
        manager["report_data"] = (digest + bytes.fromhex(manager["nonce"])).hex()
        rtmr = bytes(48)
        for event in manager["event_log"]:
            raw = struct.pack("<I", event["event_type"]) + b":" + event["event"].encode() + b":" + bytes.fromhex(event["event_payload"])
            rtmr = hashlib.sha384(rtmr + hashlib.sha384(raw).digest()).digest()
        compose = report["info"]["tcb_info"]["app_compose"]
        q = {"td_attributes": "00" * 8, "report_data": manager["report_data"], "rt_mr3": rtmr.hex(),
             "mr_config_id": (b"\x01" + hashlib.sha256(compose.encode()).digest() + bytes(15)).hex()}
        return q

    def check(self, report, policy, nonce, quote=None, status="UpToDate"):
        q = quote or self.quote(report)
        verified = Mock(status=status)
        verified.to_json.return_value = json.dumps({"report": {"TD10": q}})
        with patch("image_policy.dcap_qvl.get_collateral_and_verify", new=AsyncMock(return_value=verified)):
            return asyncio.run(verify_deployment(report, nonce, "model", policy))

    def test_exact_manifest_manager_and_recorded_source_are_accepted(self):
        report, policy, nonce = self.fixture()
        self.assertTrue(all(self.check(report, policy, nonce).values()))
        self.assertTrue(all(asyncio.run(verify_deployment(report, nonce, "gateway", policy)).values()))

    def test_unknown_or_mutated_manifest_is_refused_before_extra_quote_requests(self):
        report, policy, nonce = self.fixture()
        report["info"]["tcb_info"]["app_compose"] += " "
        with patch("image_policy.dcap_qvl.get_collateral_and_verify", new=AsyncMock()) as hardware:
            with self.assertRaisesRegex(ValueError, "DEPLOYMENT_POLICY_REJECTED"):
                asyncio.run(verify_deployment(report, nonce, "model", policy))
            hardware.assert_not_called()

    def test_validly_attested_but_unapproved_changes_fail_policy(self):
        changes = [lambda r: r["compose_manager_attestation"]["actions"][0].update(image="attacker/manager@sha256:" + "d"*64),
                   lambda r: r["compose_manager_attestation"]["actions"][1].update(commit="d"*40),
                   lambda r: r["compose_manager_attestation"]["actions"][1].update(file_sha256="d"*64),
                   lambda r: r["compose_manager_attestation"]["actions"][1].update(action="compose_down"),
                   lambda r: r["compose_manager_attestation"].update(nonce="44"*32)]
        for change in changes:
            report, policy, nonce = self.fixture()
            change(report)
            with self.subTest(), self.assertRaisesRegex(ValueError, "DEPLOYMENT_POLICY_REJECTED"):
                self.check(report, policy, nonce)

    def test_forged_actions_quote_nonce_instance_and_status_are_rejected(self):
        for field in ("report_data", "rt_mr3", "mr_config_id", "td_attributes"):
            report, policy, nonce = self.fixture()
            q = self.quote(report)
            q[field] = "01" * (len(q[field]) // 2)
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, "DEPLOYMENT_POLICY_REJECTED"):
                self.check(report, policy, nonce, quote=q)
        report, policy, nonce = self.fixture()
        report["compose_manager_attestation"]["event_log"] = copy.deepcopy(report["event_log"])
        report["compose_manager_attestation"]["event_log"][1]["event_payload"] = "55"*20
        with self.assertRaisesRegex(ValueError, "DEPLOYMENT_POLICY_REJECTED"):
            self.check(report, policy, nonce)
        report, policy, nonce = self.fixture()
        with self.assertRaisesRegex(ValueError, "DEPLOYMENT_POLICY_REJECTED"):
            self.check(report, policy, nonce, status="OutOfDate")

    def test_policy_identity_changes_when_a_pin_changes(self):
        _, policy, _ = self.fixture()
        original = policy_identity(policy)
        reordered = dict(reversed(list(policy.items())))
        self.assertEqual(policy_identity(reordered), original)
        policy["model"]["manager_image"] = "changed"
        self.assertNotEqual(policy_identity(policy)["sha256"], original["sha256"])

    def test_refused_gateway_or_model_never_sends_completion(self):
        for fail_gateway in (True, False):
            connection = Mock(fingerprint="33"*32)
            connection.request.side_effect = [b'{"gateway_attestation":{}}',
                                              json.dumps({"model_attestations": [{"model_name": MODEL}]})]
            context = Mock(); context.__enter__ = Mock(return_value=connection); context.__exit__ = Mock(return_value=False)
            checks = [ValueError("DEPLOYMENT_POLICY_REJECTED")] if fail_gateway else [{}, ValueError("DEPLOYMENT_POLICY_REJECTED")]
            with (patch.dict("os.environ", {"NEAR_AI_CLOUD_API_KEY": "fixture"}),
                  patch("inference.GatewayConnection", return_value=context),
                  patch("inference.verify_report", new=AsyncMock(return_value={})),
                  patch("inference.verify_deployment", new=AsyncMock(side_effect=checks))):
                body = json.dumps({"model": MODEL, "stream": False, "max_tokens": 128}).encode()
                with self.assertRaisesRegex(ValueError, "DEPLOYMENT_POLICY_REJECTED"):
                    asyncio.run(execute({"request_base64": base64.b64encode(body).decode()}))
                self.assertTrue(all(call.args[0] == "GET" for call in connection.request.call_args_list))
                if fail_gateway:
                    connection.authorize.assert_not_called()
                    self.assertNotIn("Authorization", connection.request.call_args.kwargs["headers"])
