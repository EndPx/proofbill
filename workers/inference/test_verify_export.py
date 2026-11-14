import asyncio
import base64
import copy
import hashlib
import json
import time
import unittest
from unittest.mock import AsyncMock, Mock, patch

import jwt
import requests
from cryptography.hazmat.primitives.asymmetric import ec

from eth_account import Account
from eth_account.messages import encode_defunct
from inference import MODEL, execute, verify_signature
from nras import ISSUER, JWKS_URL, verify_nras_response
from verify_export import commitment, read_order, validate_export


class BuyerVerificationTests(unittest.TestCase):
    def setUp(self):
        self.key = Account.create()
        self.body = json.dumps({"model": MODEL, "stream": False, "messages": [{"role": "system", "content": "Order pass-1-order-1; pass pass-1; revision 1; nonce abc."}]}).encode()
        self.output = {"item": "notebooks", "quantity": 12, "requested_by": "Maya"}
        self.response = json.dumps({"choices": [{"message": {"content": json.dumps(self.output)}}]}).encode()
        self.text = MODEL + ":" + hashlib.sha256(self.body).hexdigest() + ":" + hashlib.sha256(self.response).hexdigest()
        self.signature = {"signature_kind": "provider_tee", "signing_algo": "ecdsa", "text": self.text,
                          "signature": self.key.sign_message(encode_defunct(text=self.text)).signature.hex(),
                          "signing_address": self.key.address}
        artifacts = {"request_base64": base64.b64encode(self.body).decode(), "response_base64": base64.b64encode(self.response).decode(), "signature": self.signature}
        encoded = json.dumps(artifacts, separators=(",", ":")).encode()
        self.order = {"order_id": "pass-1-order-1", "token_id": "pass-1", "revision": 1, "phase": "Paid"}
        self.bundle = {"order_id": self.order["order_id"], "salt": "a" * 64, "artifacts": artifacts,
                       "artifact_serialization_base64": base64.b64encode(encoded).decode(), "result": {"model": MODEL, "output": self.output}}
        for kind, raw in (("request", self.body), ("response", self.response), ("evidence", encoded)):
            self.order[kind + "_commitment"] = self.bundle[kind + "_commitment"] = commitment(kind, "a" * 64, raw)
        self.candidates = [{"signing_algo": "ecdsa", "signing_address": self.key.address}]

    def test_exact_bytes_and_committed_export_pass(self):
        validate_export(self.bundle, self.order)
        self.assertEqual(verify_signature(self.signature, self.body, self.response, self.candidates), self.key.address)

    def test_modified_displayed_result_is_rejected(self):
        bundle = copy.deepcopy(self.bundle)
        bundle["result"]["output"]["quantity"] = 999
        with self.assertRaisesRegex(ValueError, "DISPLAYED_RESULT_MISMATCH"):
            validate_export(bundle, self.order)

    def test_relabelled_order_and_replaced_commitments_are_rejected(self):
        order = {**self.order, "order_id": "pass-2-order-1"}
        with self.assertRaisesRegex(ValueError, "ORDER_ID_MISMATCH"):
            validate_export(self.bundle, order)
        bundle = {**self.bundle, "request_commitment": "b" * 64}
        with self.assertRaisesRegex(ValueError, "REQUEST_COMMITMENT_MISMATCH"):
            validate_export(bundle, self.order)

    def test_response_whitespace_changes_signature_binding(self):
        with self.assertRaisesRegex(ValueError, "RESPONSE_BYTES_MISMATCH"):
            verify_signature(self.signature, self.body, self.response + b" ", self.candidates)

    def test_wrong_attested_signer_and_ambiguous_candidates_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "MODEL_SIGNER_MISMATCH"):
            verify_signature(self.signature, self.body, self.response, [])
        with self.assertRaisesRegex(ValueError, "MODEL_SIGNER_MISMATCH"):
            verify_signature(self.signature, self.body, self.response, self.candidates * 2)

    def test_forged_signature_cannot_reuse_another_models_attestation(self):
        forged = {**self.signature, "signature": Account.create().sign_message(encode_defunct(text=self.text)).signature.hex()}
        with self.assertRaisesRegex(ValueError, "MODEL_SIGNER_MISMATCH"):
            verify_signature(forged, self.body, self.response, self.candidates)

    def test_replaced_artifact_bytes_are_rejected(self):
        bundle = copy.deepcopy(self.bundle)
        bundle["artifacts"]["response_base64"] = base64.b64encode(b"forged").decode()
        with self.assertRaisesRegex(ValueError, "ARTIFACT_SERIALIZATION_MISMATCH"):
            validate_export(bundle, self.order)

    def test_order_ids_include_1000_and_the_full_contract_u32_sequence(self):
        for order_id in ("pass-1-order", "pass-1-order-1", "pass-1-order-999",
                         "pass-1-order-1000", "pass-1-order-4294967295"):
            with self.subTest(order_id=order_id), patch("verify_export.requests.post") as post:
                order = {"order_id": order_id, "phase": "Paid"}
                post.return_value.json.return_value = {
                    "result": {"result": list(json.dumps(order).encode()), "block_hash": "fixture-block"}}
                self.assertEqual(read_order(order_id), (order, "fixture-block"))
                post.return_value.raise_for_status.assert_called_once()
                payload = post.call_args.kwargs["json"]["params"]
                self.assertEqual(payload["finality"], "final")
                self.assertEqual(json.loads(base64.b64decode(payload["args_base64"])), {"order_id": order_id})

    def test_invalid_order_ids_never_reach_the_rpc(self):
        for order_id in ("pass-1-order-0", "pass-1-order-01", "pass-1-order-4294967296",
                         "pass-1-order-10000000000", "pass-0-order-1", "pass-01-order-1",
                         "pass-1-order-1x", "pass-1-order-1\n", "pass-1-order-1\u0660"):
            with self.subTest(order_id=order_id), patch("verify_export.requests.post") as post:
                with self.assertRaisesRegex(ValueError, "INVALID_ORDER_ID"):
                    read_order(order_id)
                post.assert_not_called()


class NrasVerificationTests(unittest.TestCase):
    def setUp(self):
        self.key = ec.generate_private_key(ec.SECP384R1())
        self.jwk = {**json.loads(jwt.algorithms.ECAlgorithm.to_jwk(self.key.public_key())), "kid": "fixture-key"}
        now = int(time.time())
        self.nonce = "a" * 64
        self.claims = {"iss": ISSUER, "iat": now - 1, "nbf": now - 1, "exp": now + 300,
                       "eat_nonce": self.nonce}
        self.http = Mock(status_code=200, content=b"{}")
        self.http.json.return_value = {"keys": [self.jwk]}

    def token(self, claims, key=None, headers=None):
        return jwt.encode(claims, key or self.key, algorithm="ES384",
                          headers={"kid": "fixture-key", **(headers or {})})

    def response(self, changes=None, gpu_changes=None):
        gpu = self.token({**self.claims, **(gpu_changes or {})})
        overall = {**self.claims, "sub": "NVIDIA-PLATFORM-ATTESTATION", "x-nvidia-overall-att-result": True,
                   "submods": {"GPU-0": ["DIGEST", ["SHA-256", hashlib.sha256(gpu.encode()).hexdigest()]]},
                   **(changes or {})}
        return [["JWT", self.token(overall)], {"GPU-0": gpu}]

    def verify(self, response, nonce=None):
        with patch("nras.requests.get", return_value=self.http) as get:
            result = verify_nras_response(response, nonce or self.nonce)
            get.assert_called_once_with(JWKS_URL, timeout=15, allow_redirects=False)
            return result

    def test_signed_overall_and_bound_gpu_tokens_pass(self):
        self.assertTrue(all(self.verify(self.response()).values()))

    def test_untrusted_claims_are_rejected_even_with_a_valid_signature(self):
        now = int(time.time())
        cases = [{"iss": "https://attacker.invalid"}, {"iss": ISSUER + "/attacker"},
                 {"eat_nonce": "b" * 64}, {"exp": now - 1}, {"iat": now + 300},
                 {"nbf": now + 300}, {"iat": str(now - 1)}, {"sub": "OTHER"},
                 {"x-nvidia-overall-att-result": False}, {"x-nvidia-overall-att-result": "true"}]
        for changes in cases:
            with self.subTest(changes=changes), self.assertRaisesRegex(ValueError, "^GPU_TOKEN_INVALID$"):
                self.verify(self.response(changes))
        for name in ("iss", "iat", "nbf", "exp", "eat_nonce"):
            response = self.response()
            claims = jwt.decode(response[0][1], options={"verify_signature": False})
            del claims[name]
            response[0][1] = self.token(claims)
            with self.subTest(missing=name), self.assertRaisesRegex(ValueError, "^GPU_TOKEN_INVALID$"):
                self.verify(response)

    def test_forgery_algorithm_confusion_and_unknown_keys_are_rejected(self):
        response = self.response()
        claims = jwt.decode(response[0][1], options={"verify_signature": False})
        tokens = [self.token(claims, key=ec.generate_private_key(ec.SECP384R1())),
                  self.token(claims, headers={"kid": "unknown", "jku": "https://attacker.invalid/keys"}),
                  jwt.encode(claims, "attacker" * 8, algorithm="HS256", headers={"kid": "fixture-key"}),
                  jwt.encode(claims, None, algorithm="none"), "PRIVATE_MARKER_NOT_A_TOKEN"]
        for token in tokens:
            with self.subTest(token_kind=token[:8]), self.assertRaisesRegex(ValueError, "^GPU_TOKEN_INVALID$"):
                self.verify([["JWT", token], response[1]])

    def test_detached_gpu_tokens_cannot_be_replaced_removed_or_replayed(self):
        response = self.response()
        altered = copy.deepcopy(response)
        altered[1]["GPU-0"] = self.token({**self.claims, "extra": "changed"})
        for value in (altered, [response[0], {}], [response[0], {"GPU-other": response[1]["GPU-0"]}],
                      self.response(gpu_changes={"eat_nonce": "b" * 64}),
                      self.response(gpu_changes={"exp": int(time.time()) - 1})):
            with self.subTest(), self.assertRaisesRegex(ValueError, "^GPU_TOKEN_INVALID$"):
                self.verify(value)

    def test_key_fetch_failure_and_ambiguous_keys_fail_closed(self):
        for keys in ([], [self.jwk, self.jwk], [{**self.jwk, "crv": "P-256"}], [{**self.jwk, "use": "enc"}]):
            self.http.json.return_value = {"keys": keys}
            with self.subTest(keys=len(keys)), self.assertRaisesRegex(ValueError, "^GPU_TOKEN_INVALID$"):
                self.verify(self.response())
        self.http.status_code = 302
        with self.assertRaisesRegex(ValueError, "^GPU_TOKEN_INVALID$"):
            self.verify(self.response())
        with patch("nras.requests.get", side_effect=requests.Timeout("PRIVATE_MARKER")):
            with self.assertRaisesRegex(ValueError, "^GPU_TOKEN_INVALID$"):
                verify_nras_response(self.response(), self.nonce)

    def test_nras_failure_stops_execution_before_completion(self):
        async def check():
            body = json.dumps({"model": MODEL, "stream": False, "max_tokens": 128}).encode()
            gateway = Mock(); gateway.json.return_value = {"gateway_attestation": {}}
            model = Mock(); model.json.return_value = {"model_attestations": [{"model_name": MODEL}]}
            with (patch.dict("os.environ", {"NEAR_AI_CLOUD_API_KEY": "fixture-not-a-real-key"}),
                  patch("inference.requests.get", side_effect=[gateway, model]),
                  patch("inference.verify_report", new=AsyncMock(side_effect=[{}, ValueError("GPU_TOKEN_INVALID")])),
                  patch("inference.requests.post") as completion):
                with self.assertRaisesRegex(ValueError, "^GPU_TOKEN_INVALID$"):
                    await execute({"request_base64": base64.b64encode(body).decode()})
                completion.assert_not_called()
        asyncio.run(check())


if __name__ == "__main__":
    unittest.main()
