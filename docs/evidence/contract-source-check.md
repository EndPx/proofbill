# Deployed contract and source-build check

A finalized read confirmed that the deployed ProofBill Wasm exactly matches the `contract-wasm-and-abi` artifact from [successful financial CI run 43503658521](https://github.com/EndPx/proofbill/actions/runs/43503658521), built from source commit [`a1964b0`](https://github.com/EndPx/proofbill/commit/a1964b083d6855ce6dffac940f9e69be162dc2a8). The comparison checked the complete byte arrays, not only a copied deployment manifest.

| Item | Checked value |
| --- | --- |
| Network | NEAR testnet |
| Contract | [proofbill-endpx-2026.testnet](https://testnet.nearblocks.io/address/proofbill-endpx-2026.testnet) |
| Deployed Wasm | 295,956 bytes |
| SHA-256 | `44de06a662ad2ca973a7888f62c636b8abf7e94f59578451d8c533d1ded57b90` |
| CI artifact equality | Exact byte-for-byte match |
| Contract source metadata | Public repository link present; `build_info: null` |
| Explorer source-verification badge | Not established by this check |

[The public check record](integration/contract-source-check.json) pins the final block and metadata response. It contains no signer credentials or private buyer artifact.

This is an artifact/source-revision trace, not an independent reproducible rebuild or security audit. The official [SourceScan verification workflow](https://github.com/SourceScan/verification-guide) uses reproducible build metadata to reconstruct and compare the deployed contract. The current deployed source metadata does not include that build information.

Replacing the current Wasm with a reproducibly built release is a deployment change and needs its own state-preservation checks. This inspection did not deploy code, reinitialize state, change keys, or transfer funds merely to obtain a badge. Existing FullAccess administrator trust remains unchanged.
