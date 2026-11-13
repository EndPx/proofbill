# Repeated asynchronous NFT transfer storage credit

Validated 13 November 2026 with Rust 1.99.1, NEAR SDK 5.30.1 and actual Wasm in Sandbox. No paid inference is part of these tests.

## Reproduction on the previous implementation

The new unit regression failed because a returned NFT lost the entire 1,024-byte reserve. The same-token Wasm regression against the previous deployed artifact reproduced the availability failure:

```text
credit bytes: 2070 -> 1046 -> 22
third asynchronous transfer: authorization revision stayed 2 instead of advancing to 3
```

The token returned to its owner, but the unused reserve was not restored. This was a storage-credit/use/portability failure, not demonstrated theft of the service allocation.

## Correction

An asynchronous handover keeps its rollback reserve in a temporary `pb:nft-transfer:` record. Initiation charges its own actual storage changes while holding that reserve. Resolution reads the canonical owner, unlocks the token, removes the temporary record, releases the held reserve and accounts for that receipt's actual storage change.

Storage is measured separately inside each receipt. A single global before/after spanning the asynchronous call would incorrectly include unrelated operations executed in between. The test receiver deliberately mints another funded NFT before returning the first one; the combined credits are checked against actual account storage growth to detect that mistake.

Failed/returned handovers on an otherwise unchanged pass leave its storage credit unchanged. Keep/round-trip transfers charge only actual permanent changes and return freed storage to credit. The service amount is untouched. This is a credit reconciliation inside the contract, not a wallet transfer of the separate storage budget.

No root/pass/order Borsh layout changed. A legacy pending transfer without the new marker can still resolve conservatively without inventing a refund; the operator upgrade guard additionally requires no pending transfers. The private resolver and pending flag prevent a second release. Initiation rejects insufficient storage before dispatching the receiver promise.

## Checks

- Eight Rust unit tests passed, including four repeated returned handovers on the same token.
- Both `purchase_rights_callbacks_and_refund` and `repeated_async_storage_credit` passed against the candidate Wasm.
- Repeated true-return and missing-method failure cases preserve owner, advance the authorization revision and release the pending flag; all six retained exactly 2,070 bytes in this Sandbox setup.
- Four ordinary keep round trips plus two maximum-length account-ID round trips preserve credit on return to the starting state.
- An interleaved mint is charged to its own pass; the total credit changes match actual contract storage growth.
- An unused transfer clears the agent and Automatic policy. Forged/stale resolver calls are rejected without releasing credit again.
- The repeatedly transferred entitlement can still assign an agent, reserve its order and complete a service-allocation refund.
- Existing Manual/Automatic payout, payout failure, refund, active-transfer lock and duplicate-payment checks still pass.

The candidate is 575,219 bytes with SHA-256 `52c6324967bf8157c05b15bc276a28a12aca204caf07028208788d0d2f2dd10b`. Build: `RUSTFLAGS=--cfg=near cargo build --locked --target wasm32-unknown-unknown --release`. Sandbox used its own isolated Ubuntu 24.04 runtime for glibc compatibility. Deployment and hosted smoke results are recorded separately.
