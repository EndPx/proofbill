import base64
import copy
import hashlib
import json
import unittest
from unittest.mock import patch

from eth_account import Account
from eth_account.messages import encode_defunct
from inference import MODEL, verify_signature
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


if __name__ == "__main__":
    unittest.main()
