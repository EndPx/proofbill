# Agent and payment policy contract checks

Validated 13 November 2026 with Rust 1.99.1, the pinned lockfile and NEAR SDK 5.30.1. This is local Wasm/Sandbox evidence with synthetic publisher statements, not a live NEAR AI claim.

Seven unit tests passed. They cover ownership transfer, old-holder rejection, single-use reservation, Manual default with unchanged stored pass layout, owner-only Automatic authorization, fixed seller/amount payment initiation and publisher-only delivery.

The expanded `purchase_rights_callbacks_and_refund` Sandbox scenario passed against the candidate Wasm. It checks:

- NFT receiver keep/return/failure and transferred refund rights.
- Failed native seller payout, refund and rejection of a stale payment retry.
- Manual delivery remaining Delivered until owner action.
- Automatic payout failure becoming TransferFailed rather than Paid, with a working refund exit.
- Assigned custom agent reservation; wrong signer, policy change while active, active transfer, forged publisher, mismatched request and direct callback calls rejected.
- Successful Automatic seller transfer and callback producing Paid without an owner approval call.
- Duplicate delivery/payment rejected after settlement; NFT owner remains the buyer.

The contract stores optional payment policy under a separate `pb:payment:` prefix. Existing root/pass/order Borsh layouts remain unchanged. Missing policy means Manual. An unused transfer removes Automatic permission and clears the agent. Active orders prevent changing these settings.

The contract still trusts its configured publisher's offchain evidence assertion. Automatic mode is explicit advance authorization for that fixed service payment, not a proof of answer quality or permission for arbitrary agent spending. Manual is the default.

Build command:

```sh
RUSTFLAGS=--cfg=near cargo build --locked --target wasm32-unknown-unknown --release
cargo test --locked --lib
PROOFBILL_WASM=/path/to/proofbill.wasm cargo test --locked --test test_basics -- --nocapture
```

The build used the server's Rust 1.99.1 tool image. The compiled Sandbox scenario ran in an isolated Ubuntu 24.04 container because the downloaded Sandbox binary requires newer glibc than the compiler image supplies. No live worker was stopped for this test.

Candidate Wasm: 573,498 bytes, SHA-256 `159e19134f9f56a226ae958c478b589739e5350e15f4be46aaea0bfccdf795cb`. Deployment and hosted-provider results are recorded separately after validation.
