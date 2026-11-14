"""One gateway TLS socket; no reconnect or credential before attestation."""
import base64
import hashlib
import http.client
import json
import os
import ssl

import requests
from cryptography import x509
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

HOST = "cloud-api.near.ai"


def certificate_spki(certificate):
    key = x509.load_der_x509_certificate(certificate).public_key()
    return hashlib.sha256(key.public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)).hexdigest()


def report_identity(identity, fingerprint=None):
    if fingerprint is None:
        return identity.ljust(32, b"\0")
    try:
        raw = bytes.fromhex(fingerprint)
    except (TypeError, ValueError):
        raise ValueError("TLS_BINDING_INVALID") from None
    if len(raw) != 32:
        raise ValueError("TLS_BINDING_INVALID")
    return hashlib.sha256(identity + raw).digest()


class _Connection(http.client.HTTPSConnection):
    connected_once = False

    def connect(self):
        if self.connected_once:
            raise ValueError("TLS_RECONNECT_REQUIRES_ATTESTATION")
        super().connect()
        self.connected_once = True


class GatewayConnection:
    def __enter__(self):
        ca = os.environ.get("REQUESTS_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE") or requests.certs.where()
        self.connection = _Connection(HOST, timeout=50, context=ssl.create_default_context(cafile=ca))
        self.authorized = False
        try:
            self.connection.connect()
            self.socket = self.connection.sock
            self.certificate = self.socket.getpeercert(binary_form=True)
            self.fingerprint = certificate_spki(self.certificate)
            return self
        except BaseException:
            self.connection.close()
            raise

    def __exit__(self, *_):
        self.authorized = False
        self.connection.close()

    def authorize(self, verified_gateway):
        if (verified_gateway.get("tls_fingerprint") != self.fingerprint
                or verified_gateway.get("checks", {}).get("tls_peer_bound") is not True):
            raise ValueError("TLS_BINDING_INVALID")
        self.authorized = True

    def request(self, method, path, *, body=None, headers=None, timeout=50, allow_pending=False):
        headers = headers or {}
        if not self.authorized and (method != "GET" or body is not None
                                    or any(name.lower() == "authorization" for name in headers)):
            raise ValueError("TLS_BINDING_REQUIRED")
        if not path.startswith("/v1/") or self.connection.sock is not self.socket:
            raise ValueError("TLS_RECONNECT_REQUIRES_ATTESTATION")
        self.socket.settimeout(timeout)
        self.connection.request(method, path, body=body, headers=headers)
        response = self.connection.getresponse()
        raw = response.read(8_000_001)
        if len(raw) > 8_000_000:
            raise ValueError("GATEWAY_RESPONSE_TOO_LARGE")
        if response.status != 200 and not (allow_pending and response.status in (202, 404)):
            raise ValueError("GATEWAY_RESPONSE_UNAVAILABLE")
        return raw

    def evidence(self):
        return {"kind": "gateway-same-connection-spki-v1", "host": HOST,
                "peer_certificate_der_base64": base64.b64encode(self.certificate).decode(),
                "peer_spki_sha256": self.fingerprint}
