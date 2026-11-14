"""Authenticate NRAS results against NVIDIA's fixed HTTPS JWKS endpoint."""
import hashlib
import re

import jwt
import requests

ISSUER = "https://nras.attestation.nvidia.com"
JWKS_URL = ISSUER + "/.well-known/jwks.json"


def _claims(token, nonce, keys):
    if not isinstance(token, str) or len(token) > 65536:
        raise ValueError("GPU_TOKEN_INVALID")
    header = jwt.get_unverified_header(token)
    if header.get("alg") != "ES384" or not isinstance(header.get("kid"), str):
        raise ValueError("GPU_TOKEN_INVALID")
    matches = [key for key in keys if key.get("kid") == header["kid"]]
    if len(matches) != 1:
        raise ValueError("GPU_TOKEN_INVALID")
    key = matches[0]
    if (key.get("kty") != "EC" or key.get("crv") != "P-384"
            or key.get("use", "sig") != "sig" or key.get("alg", "ES384") != "ES384"):
        raise ValueError("GPU_TOKEN_INVALID")
    claims = jwt.decode(token, jwt.PyJWK.from_dict(key, algorithm="ES384").key,
                        algorithms=["ES384"], issuer=ISSUER,
                        options={"require": ["iss", "iat", "nbf", "exp", "eat_nonce"]})
    if (claims.get("eat_nonce") != nonce
            or any(type(claims[name]) is not int for name in ("iat", "nbf", "exp"))
            or claims["exp"] <= max(claims["iat"], claims["nbf"])):
        raise ValueError("GPU_TOKEN_INVALID")
    return claims


def verify_nras_response(response, nonce):
    """Verify overall/per-GPU signatures, claims and detached-token bindings.

    Key URLs in token headers are never followed. Saved evidence is submitted to
    NRAS again by the caller; an expired saved JWT is not accepted as fresh.
    """
    try:
        if not isinstance(nonce, str) or not re.fullmatch(r"[a-f0-9]{64}", nonce):
            raise ValueError("GPU_TOKEN_INVALID")
        if (not isinstance(response, list) or len(response) != 2
                or not isinstance(response[0], list) or len(response[0]) != 2
                or response[0][0] != "JWT" or not isinstance(response[1], dict)
                or not 1 <= len(response[1]) <= 64):
            raise ValueError("GPU_TOKEN_INVALID")
        # No token-provided jku/x5u, redirects or application API credentials.
        result = requests.get(JWKS_URL, timeout=15, allow_redirects=False)
        if result.status_code != 200 or len(result.content) > 1_000_000:
            raise ValueError("GPU_TOKEN_INVALID")
        keys = result.json()["keys"]
        if not isinstance(keys, list) or not all(isinstance(key, dict) for key in keys):
            raise ValueError("GPU_TOKEN_INVALID")
        overall = _claims(response[0][1], nonce, keys)
        if (overall.get("sub") != "NVIDIA-PLATFORM-ATTESTATION"
                or overall.get("x-nvidia-overall-att-result") is not True
                or not isinstance(overall.get("submods"), dict)
                or set(overall["submods"]) != set(response[1])):
            raise ValueError("GPU_TOKEN_INVALID")
        for gpu, token in response[1].items():
            _claims(token, nonce, keys)
            binding = ["DIGEST", ["SHA-256", hashlib.sha256(token.encode()).hexdigest()]]
            if overall["submods"][gpu] != binding:
                raise ValueError("GPU_TOKEN_INVALID")
        return {"signatures": True, "issuer_and_time": True, "nonce": True, "gpu_bindings": True}
    except (ValueError, TypeError, KeyError, jwt.PyJWTError, requests.RequestException):
        # Untrusted tokens and vendor exception strings never enter job logs/API errors.
        raise ValueError("GPU_TOKEN_INVALID") from None
