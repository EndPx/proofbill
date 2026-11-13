# Hosted reusable budget and buyer verification

Validated 14 November 2026, Asia/Jakarta. App: [ProofBill](https://proofbill-two.vercel.app). Contract: `proofbill-endpx-2026.testnet`. These are project-owned testnet accounts and synthetic purchase briefs, not independent users or traction.

## Two real purchases from one NFT

The [pass-12 record](integration/budget-pass-12.json) covers an initial **0.030 native NEAR service budget**. A separate external agent account reserved and submitted two orders using the hosted API/worker and actual NEAR AI inference:

| Order | Policy | Service payment | Final state | Public receipt |
| --- | --- | --- | --- | --- |
| `pass-12-order-1` | Automatic | 0.010 NEAR | Paid | [Receipt](https://proofbill-two.vercel.app/receipts/pass-12-order-1) |
| `pass-12-order-2` | Manual | 0.010 NEAR | Paid | [Receipt](https://proofbill-two.vercel.app/receipts/pass-12-order-2) |

After both purchases the pass had 0.010 available, zero reserved and 0.020 spent. The holder [transferred the remaining entitlement](https://testnet.nearblocks.io/txns/2eCAe2LXRm5kUeirASGszwi4EkeqxL3dYcZTcMTWPWLf); assignment and Automatic permission were cleared. The old holder's refund was refused. The new holder [successfully refunded the remaining 0.010](https://testnet.nearblocks.io/txns/7ypWE5ZXZ9kfThudzVbre8BC2RJshLdkGjZEn1fUrNDp). Final conservation: **0.030 funded = 0.020 spent + 0.010 refunded**, with zero available/reserved. Storage backing was excluded.

Each order kept its original policy and historical buyer after later settings, ownership and refund changes. Both private exports returned HTTP 200 to the authenticated historical buyer, HTTP 404 to the new NFT holder and HTTP 401 anonymously. Public receipts remained anonymous and Paid. Each order has one delivered job and a recorded provider attempt. The [second-order integration](integration/pass-12-order-2.json) also records agent settings/approval refusals and duplicate-payment rejection.

## Buyer-run verification and tampering

The [independent verifier report](integration/buyer-verification-pass-12-order-2.json) uses a buyer-authorized export of the actual second response. It rechecks finalized-chain commitments, the signed order context, displayed output, exact response signature, Intel TDX preflight and the NVIDIA NRAS HTTPS result. It does not trust the export's claimed check labels and performs no new inference.

A [modified copy of the same export](integration/buyer-verification-tamper.json) changed the displayed quantity. Verification failed with `DISPLAYED_RESULT_MISMATCH`; no transaction was sent and no new inference ran. Private exports, original bodies, salts and credentials are not published. See [buyer verification instructions and limits](../verify-private-result.md).

## Build, upgrade and compatibility

The [initial version-3 deployment](../../infra/near/reusable-budget-upgrade.json) preserved eleven passes and ten orders. A live refusal check exposed a build configuration mistake: the plain wasm-target build omitted the SDK's `--cfg near` and returned generic traps for denied actions. It still refused those actions; the first paid purchase and budget state remained intact.

The contract was rebuilt with **cargo-near 0.22.0 / rustc 1.99.1**, then all three Wasm/Sandbox scenarios passed again, including an exact `HOLDER_ONLY` assertion. The [official-build upgrade](../../infra/near/reusable-budget-near-build-upgrade.json) preserved twelve passes and eleven orders, including the first budget purchase, without initialization. Current Wasm: **285,307 bytes**, SHA-256 `1394b19623905da0797bf78332543a4d34b2b2f3cc5eecb05d2b9a384b0c2d63`. The generated ABI matches that artifact. The second real purchase, exact refusal checks, handover and refund used this build.

Local checks: twelve Rust tests, three Wasm/Sandbox scenarios, nineteen TypeScript tests, thirty-three PostgreSQL queue/recovery tests, thirty-three production-build browser journeys and seven cryptographic export/tamper tests. Test counts are scoped to this release. Scripted HTTP/signature checks do not establish human browser-wallet confirmation. Evidence does not prove answer accuracy, operator blindness, local NRAS JWT-chain verification, TLS binding, source-image policy, a security audit or mainnet readiness.
