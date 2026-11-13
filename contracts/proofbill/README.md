# ProofBill contract

Rust/near-sdk contract for a single-service NFT Purchase Pass, one bound order, native testnet NEAR payment and service refund. Manual mode requires buyer approval after delivery. Automatic mode uses explicit per-pass owner authorization and matching publisher delivery. Both mark Paid only after the seller-transfer callback succeeds; failed-payment retries require buyer approval. Use `infra/near/testnet-init.json` only for the declared project deployment; replace identities for your own deployment.

```sh
cargo near build non-reproducible-wasm --locked
cargo test --lib
cargo test --test test_basics -- --nocapture
```

The tool prints the resulting Wasm/ABI paths. Local Windows verification used WSL, an isolated `CARGO_TARGET_DIR`, and the pinned Rust toolchain. Sandbox receiver fixtures are local test-only Wasm; publisher evidence is synthetic in those tests. Actual provider verification lives in `workers/inference` and has separate testnet execution evidence.

The checked-in `abi.json` is an initial-build snapshot tied to its embedded Wasm hash. It predates the optional `payment_mode` argument on `create_purchase_pass` and `assign_agent`; do not use it as the current release ABI. Build from the intended revision and use that build's ABI together with [the Rust source](src/lib.rs). The [deployment record](../../infra/near/testnet-deployment.json) and [later storage upgrade](../../infra/near/nft-storage-credit-upgrade.json) identify the corresponding deployed artifacts.

Contract ownership/payment state is authoritative. Publisher assertions are trusted offchain-verifier statements, not onchain hardware-quote verification. Private callbacks consume exact attempt results; unknown outcomes are not automatically retried or refunded.

The 0.030 testnet NEAR storage budget backs NFT/order/history growth, separately from the 0.010 service allocation. No mainnet-readiness or audit claim is made.
