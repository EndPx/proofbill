import asyncio
import hashlib
import json
import ssl
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

from inference import MODEL, execute, verify_report
from tls_binding import GatewayConnection, _Connection, certificate_spki


class SocketBindingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        key = ec.generate_private_key(ec.SECP256R1())
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
        now = datetime.now(timezone.utc)
        cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
                .serial_number(x509.random_serial_number()).not_valid_before(now - timedelta(minutes=1))
                .not_valid_after(now + timedelta(days=1))
                .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost")]), critical=False)
                .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
                .sign(key, hashes.SHA256()))
        cls.pem = Path(cls.directory.name) / "certificate.pem"
        private = Path(cls.directory.name) / "key.pem"
        cls.pem.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
        private.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        cls.records = []

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def do_GET(self):
                self.respond()

            def do_POST(self):
                self.respond()

            def respond(self):
                body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
                cls.records.append({"socket": id(self.connection), "body": body, "auth": self.headers.get("Authorization")})
                self.send_response(302 if self.path == "/v1/redirect" else 200)
                self.send_header("Content-Length", "2")
                self.send_header("Location", "https://attacker.invalid/")
                self.end_headers()
                self.wfile.write(b"{}")

            def log_message(self, *_):
                pass

        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cls.pem, private)
        cls.server.socket = context.wrap_socket(cls.server.socket, server_side=True)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.directory.cleanup()

    def setUp(self):
        self.records.clear()
        self.ca = patch("tls_binding.requests.certs.where", return_value=str(self.pem))
        self.factory = patch("tls_binding._Connection", side_effect=lambda host, **kw: _Connection("localhost", self.server.server_port, **kw))
        self.ca.start(); self.factory.start()
        self.addCleanup(self.ca.stop); self.addCleanup(self.factory.stop)

    def test_no_credentials_until_attestation_and_exact_body_uses_same_socket(self):
        with GatewayConnection() as gateway:
            with self.assertRaisesRegex(ValueError, "TLS_BINDING_REQUIRED"):
                gateway.request("GET", "/v1/models", headers={"Authorization": "Bearer fixture"})
            with self.assertRaisesRegex(ValueError, "TLS_BINDING_REQUIRED"):
                gateway.request("POST", "/v1/chat/completions", body=b"private")
            self.assertEqual(self.records, [])
            gateway.request("GET", "/v1/attestation/report")
            gateway.authorize({"tls_fingerprint": gateway.fingerprint, "checks": {"tls_peer_bound": True}})
            body = b'{"private":"synthetic", "exact":"bytes\\n"}'
            gateway.request("POST", "/v1/chat/completions", body=body, headers={"Authorization": "Bearer fixture"})
            self.assertEqual(self.records[0]["socket"], self.records[1]["socket"])
            self.assertIsNone(self.records[0]["auth"])
            self.assertEqual(self.records[1]["body"], body)
            self.assertEqual(self.records[1]["auth"], "Bearer fixture")

    def test_wrong_fingerprint_socket_replacement_and_reconnect_are_refused(self):
        with GatewayConnection() as gateway:
            with self.assertRaisesRegex(ValueError, "TLS_BINDING_INVALID"):
                gateway.authorize({"tls_fingerprint": "0" * 64, "checks": {"tls_peer_bound": True}})
            original = gateway.connection.sock
            gateway.connection.sock = object()
            try:
                with self.assertRaisesRegex(ValueError, "TLS_RECONNECT_REQUIRES_ATTESTATION"):
                    gateway.request("GET", "/v1/attestation/report")
            finally:
                gateway.connection.sock = original
            gateway.connection.close()
            with self.assertRaisesRegex(ValueError, "TLS_RECONNECT_REQUIRES_ATTESTATION"):
                gateway.connection.connect()
            self.assertEqual(self.records, [])

    def test_redirect_is_not_followed(self):
        with GatewayConnection() as gateway:
            with self.assertRaisesRegex(ValueError, "GATEWAY_RESPONSE_UNAVAILABLE"):
                gateway.request("GET", "/v1/redirect")
        self.assertEqual(len(self.records), 1)


class QuoteBindingTests(unittest.TestCase):
    def fixture(self, fingerprint=None):
        identity, nonce, compose = bytes.fromhex("11" * 20), "22" * 32, "{}"
        bound = identity.ljust(32, b"\0") if fingerprint is None else hashlib.sha256(identity + bytes.fromhex(fingerprint)).digest()
        quote = {"report_data": (bound + bytes.fromhex(nonce)).hex(), "td_attributes": "00" * 8,
                 "mr_config_id": (b"\x01" + hashlib.sha256(compose.encode()).digest() + bytes(15)).hex(),
                 "rt_mr3": bytes(48).hex()}
        verified = Mock(status="UpToDate")
        verified.to_json.return_value = json.dumps({"report": {"TD10": quote}})
        report = {"signing_address": "0x" + identity.hex(), "signing_algo": "ecdsa", "request_nonce": nonce,
                  "intel_quote": "01", "event_log": [], "info": {"tcb_info": {"app_compose": compose}}}
        if fingerprint is not None:
            report["tls_cert_fingerprint"] = fingerprint
        return report, nonce, verified

    def test_signed_spki_and_nonce_binding_and_legacy_quote_remain_distinct(self):
        for fingerprint in (None, "33" * 32):
            report, nonce, verified = self.fixture(fingerprint)
            with patch("inference.dcap_qvl.get_collateral_and_verify", new=AsyncMock(return_value=verified)):
                result = asyncio.run(verify_report(report, nonce, False, peer_spki_sha256=fingerprint))
                self.assertTrue(result["checks"]["signer_bound"])
                self.assertEqual(result["checks"].get("tls_peer_bound"), True if fingerprint else None)
                with self.assertRaisesRegex(ValueError, "PREFLIGHT_CHECK_FAILED"):
                    asyncio.run(verify_report(report, nonce, False, peer_spki_sha256="44" * 32))

    def test_edited_tls_fingerprint_does_not_match_verified_quote(self):
        report, nonce, verified = self.fixture("33" * 32)
        report["tls_cert_fingerprint"] = "44" * 32
        with patch("inference.dcap_qvl.get_collateral_and_verify", new=AsyncMock(return_value=verified)):
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_CHECK_FAILED"):
                asyncio.run(verify_report(report, nonce, False, peer_spki_sha256="44" * 32))

    def test_gateway_failure_stops_before_api_key_and_completion(self):
        body = json.dumps({"model": MODEL, "stream": False, "max_tokens": 128}).encode()
        import base64
        connection = Mock(fingerprint="33" * 32)
        connection.request.return_value = b'{"gateway_attestation":{}}'
        context = Mock(); context.__enter__ = Mock(return_value=connection); context.__exit__ = Mock(return_value=False)
        with (patch.dict("os.environ", {"NEAR_AI_CLOUD_API_KEY": "fixture"}),
              patch("inference.GatewayConnection", return_value=context),
              patch("inference.verify_report", new=AsyncMock(side_effect=ValueError("TLS_BINDING_INVALID")))):
            with self.assertRaisesRegex(ValueError, "TLS_BINDING_INVALID"):
                asyncio.run(execute({"request_base64": base64.b64encode(body).decode()}))
        connection.authorize.assert_not_called()
        connection.request.assert_called_once()
        self.assertNotIn("Authorization", connection.request.call_args.kwargs["headers"])
