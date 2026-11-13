# Verify your private delivery

The historical buyer can unlock an order in the workspace and export its private evidence. Keep that JSON file out of Git, public uploads and shared logs: it contains the brief, result, salt and raw provider evidence. Public receipts alone do not reveal these bytes.

Install `workers/inference/requirements.txt` in an isolated Python 3.12 environment, then run:

```sh
python workers/inference/verify_export.py /private/path/proofbill-pass-12-order-1.json
```

The verifier reads the order from the declared testnet contract through the public RPC, compares request/response/evidence commitments, checks the signed order context and displayed result, independently checks the saved Intel TDX/model preflight and NVIDIA NRAS result, and recovers the response signer. It ignores the export's claimed pass/fail check labels. It needs no wallet key or NEAR AI API key and runs no completion request.

The brief/result stays on your machine. Network calls send only public order lookup arguments, hardware quote/collateral material and the saved NVIDIA attestation payload to their verification services. The JSON summary excludes private content. Modified bytes, relabelled orders, replaced commitments, forged/wrong signers and ambiguous signer matches fail validation. An unavailable RPC/collateral/NRAS service is not verification success.

This verifies historical delivery evidence, not a fresh inference, semantic answer quality or a current deployment's identity. The contract still trusts its publisher. The verifier relies on the selected testnet RPC for chain reads and on NRAS over authenticated HTTPS for GPU results; local NRAS JWT-chain validation, TLS connection binding and a source-image allowlist remain unchecked. The application operator processes plaintext while serving the purchase.

Seven unit tests use synthetic locally signed response fixtures and no provider requests. They test byte integrity, displayed-output tampering, order relabelling, commitment replacement, response whitespace changes, forged/wrong signers and ambiguous candidates. They do not establish a real TEE attestation. Hosted artifact verification is recorded separately when exercised.
