# ProofBill contract

Rust/near-sdk contract for a single-service NFT Purchase Pass, one bound order, holder-approved native payment and service refund. Use `infra/near/testnet-init.json` only for the declared project deployment; replace identities for your own deployment.

```sh
cargo near build non-reproducible-wasm --locked
cargo test --lib
cargo test --test test_basics -- --nocapture
```

The tool prints the resulting Wasm/ABI paths. Local Windows verification used WSL, an isolated `CARGO_TARGET_DIR`, and the pinned Rust toolchain. Sandbox receiver fixtures are local test-only Wasm; publisher evidence is synthetic in those tests. Actual provider verification lives in `workers/inference` and has separate testnet execution evidence.

Contract ownership/payment state is authoritative. Publisher assertions are trusted offchain-verifier statements, not onchain hardware-quote verification. Private callbacks consume exact attempt results; unknown outcomes are not automatically retried or refunded.

The 0.030 testnet NEAR storage budget backs NFT/order/history growth, separately from the 0.010 service allocation. No mainnet-readiness or audit claim is made.
