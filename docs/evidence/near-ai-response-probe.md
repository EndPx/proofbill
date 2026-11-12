# NEAR AI response feasibility probe

**Result: one actual response passed the stated provenance/integrity checks.**

Captured and verified at 13 November 2026, 01:07:55 WIB / 12 November 2026, 18:07:55 UTC. This is a dated observation. It is not fresh attestation for future requests.

## Observed response

| Field | Value |
| --- | --- |
| Model requested and returned | `Qwen/Qwen3.8-27B` |
| Prompt | `Reply with exactly the word ProofBill.` |
| Output content | `ProofBill`, preceded by two newline bytes |
| Completion calls | One, non-streaming; no automatic completion retry |
| HTTP status | 200 |
| Signature | ECDSA, explicit `provider_tee` |
| Recovered signer | `0x835AB53d20294Ef795906DFf21aE4C045336aa26` |
| Chat ID | `e92c83eabdef40c69a9119812f0bc5e9` |
| Usage | 60 prompt tokens, 37 completion tokens |

Free NEAR Builders inference credits were used; this was not a native-NEAR payment. No API credential is included in the evidence.

## Checks

1. Gateway and model preflight reports used fresh client nonces and were verified before the completion attempt. All returned model candidates were checked; this request returned one.
2. Intel quote verification using `dcap-qvl==0.7.1` reported UpToDate. Debug-disabled, signer/nonce, configuration, event-digest and RTMR3 bindings matched. Gateway report-data echo matched as well.
3. NVIDIA NRAS, reached over authenticated HTTPS, accepted the GPU evidence and matched the nonce.
4. The exact transmitted request and uncompressed response bytes were retained. Their SHA-256 hashes matched the model-prefixed signed payload.
5. EIP-191 recovery matched the declared signer and exactly one verified model preflight result.
6. Offline replay accepted the original bytes and rejected adding one whitespace byte to either the request or response. It checked the algorithm and preflight-before-completion timestamps too.

## Evidence

The [evidence directory](near-ai-response-probe/) includes exact request/response bodies, signature, original public preflight reports, dated verification results, attempt/status records and the offline replay result. The prompt/output are synthetic and contain no user document.

Request SHA-256: `176cad13c22a0982b15bced14f8c5468c5fbfac814df12fe0bcb1e4ee6961ed8`

Response SHA-256: `9473244b660d1ecd2d4287128e1427423bbb47edea2b23b9ce73a14bedf547f3`

The supplied JSON results are execution records. Independently recomputing hashes/signature recovery is distinct from independently revalidating the retained hardware quotes and vendor collateral. This initial repository does not yet package the diagnostic runner as a maintained verifier product.

## Scope limits

- Signature integrity and matched attested signer do not prove semantic correctness or usefulness of the answer.
- Model instances can share a signer; this does not prove the response came from one unique serving instance.
- TLS peer-SPKI binding and independent source/image measurement allowlisting were not checked. Configuration matched the report's measured configuration, not an independently approved source policy.
- NRAS was trusted via authenticated HTTPS. Its JWT signing chain was not independently validated locally.
- Gateway preflight plus a model signature do not establish a complete model-to-gateway-to-TLS chain.
- No ProofBill application, NFT, budget contract, payout, refund, private session or onchain verifier was implemented in this probe.

Protocol reference: [NEAR AI response signatures](https://docs.near.ai/cloud/verification/cloud-api/response-signatures).
