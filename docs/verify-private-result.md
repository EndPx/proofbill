# Verify your private delivery

The historical buyer can unlock an order in the workspace and export its private evidence. Keep that JSON file out of Git, public uploads and shared logs: it contains the brief, result, salt and raw provider evidence. Public receipts alone do not reveal these bytes.

Install `workers/inference/requirements.txt` in an isolated Python 3.12 environment, then run:

```sh
python workers/inference/verify_export.py /private/path/proofbill-pass-12-order-1.json
```

The verifier reads the order from the declared testnet contract through the public RPC, compares request/response/evidence commitments, checks the signed order context and displayed result, independently checks the saved Intel TDX/model preflight and NVIDIA NRAS result, and recovers the response signer. It ignores the export's claimed pass/fail check labels. It needs no wallet key or NEAR AI API key and runs no completion request.

The brief/result stays on your machine. Network calls send only public order lookup arguments, hardware quote/collateral material and the saved NVIDIA attestation payload to their verification services. The JSON summary excludes private content. Modified bytes, relabelled orders, replaced commitments, forged/wrong signers and ambiguous signer matches fail validation. An unavailable RPC/collateral/NRAS service is not verification success.

The current verifier authenticates the overall and per-GPU NRAS JWT signatures using ES384 and NVIDIA's fixed HTTPS JWKS endpoint. It checks the exact issuer, required validity times, signed nonce and the overall token's SHA-256 bindings to every detached GPU token. Unknown/ambiguous keys, altered tokens, expired results and unavailable signing keys fail verification. Token-provided key URLs and redirects are not followed. Saved hardware payloads are resubmitted to NRAS; an expired saved JWT is not treated as fresh evidence.

This verifies historical delivery evidence, not a fresh inference, semantic answer quality or a current deployment's identity. The contract still trusts its publisher. The verifier relies on the selected testnet RPC for chain reads and authenticated HTTPS for NVIDIA signing keys. New exports carry a recorded peer certificate whose SPKI is compared with the quote-bound gateway fingerprint; this cannot independently re-observe the worker's historical socket. Legacy exports without this record gain no TLS check. See [TLS binding scope](evidence/tls-image-policy.md). A source-image allowlist remains unchecked. The application operator processes plaintext while serving the purchase. Older encrypted deliveries keep their original check labels and declared scope; the buyer-run verifier applies the current checks without rewriting those artifacts.

Fifteen unit tests, with multiple adversarial subcases, use synthetic locally signed fixtures and stubbed network boundaries. They cover byte integrity, displayed-output tampering, order identity/range, commitment replacement, response whitespace changes, forged/wrong signers, NRAS algorithm/key/issuer/time/nonce failures and detached GPU substitution. A failed preflight stops execution before a completion request. These fixtures do not establish a real TEE attestation. The [hosted release](evidence/budget-pass-hosted.md) separately records successful verification of a real buyer export and rejection of a modified copy; the [privacy-hardening record](evidence/privacy-hardening.md) identifies the additional live NRAS check.
