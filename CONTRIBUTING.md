# Contributing to ProofBill

ProofBill is a testnet MVP for bounded AI service purchases. Keep changes tied to a user journey or a concrete correctness issue. The implementation uses native NEAR for its fixed-price service; it does not currently offer a service marketplace or autonomous seller selection.

## Start locally

Use Node.js 24 and pnpm 10.21.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The landing page and wallet entry can be inspected without production credentials. A complete purchase requires your own database, artifact-encryption key, testnet contract and operational accounts, and funded NEAR AI API access. Follow the [complete service setup](docs/development.md#local-development). Do not reuse deployment keys from another environment.

## Check a change

```sh
pnpm check
pnpm test
pnpm build
pnpm --filter @proofbill/web exec playwright install chromium
pnpm --filter @proofbill/web test:browser
```

On Linux, install browser system dependencies with `playwright install --with-deps chromium` instead. The browser test configuration builds and starts a production server on port 3215. `PLAYWRIGHT_BASE_URL` selects an existing server; `PLAYWRIGHT_CHANNEL` optionally selects an installed browser such as `msedge`.

Browser wallet fixtures exercise connector events, cancellation, restoration and disconnect without real signatures or chain writes. They also cover the landing workflow, handover illustration, keyboard FAQ, no-JavaScript rendering, reduced motion and accessibility. Passing them does not establish a real provider call or onchain settlement.

Motion cases initialize real WebGL with a software-renderer fallback, exercise pause and manual shape changes, reverse the scroll chapters, inspect pointer tilt, and simulate GPU-context loss/restoration. The test runner's SwiftShader flag is confined to automated browser launches; it is not an application setting.

Contract checks use the toolchain pinned in `contracts/proofbill/rust-toolchain.toml`:

```sh
cd contracts/proofbill
cargo test --lib
cargo test --test test_basics -- --nocapture
```

The workflow has a separate financial-contract job using Rust 1.99.1, checksum-pinned cargo-near 0.22.0 and actual Wasm/Sandbox tests. It builds with the SDK's required NEAR configuration and checks refusal reasons, callback outcomes, budget conservation and NFT rights. The web, Python and PostgreSQL jobs do not substitute for that contract job. Sandbox publisher data remains synthetic; CI sends no transactions to a public chain and consumes no inference credits. Read [the contract guide](contracts/proofbill/README.md) for reproduction.

## Respect the boundaries

- The contract owns funds, NFT ownership and final payment/refund state. Database rows and frontend observations do not authorize a payout.
- Use integer strings or `bigint` for amounts. Keep pending, confirmed and failed states distinct.
- Private artifacts belong to the historical buyer. Public receipts expose financial facts and commitments, not plaintext prompts or results.
- Read the source before changing an ABI, worker retry, callback or ownership rule. Include a focused regression test when behavior changes.
- Keep credentials, real env files, raw private payloads, build output and local review notes out of Git. Public evidence must be scoped and sanitized.

## Make a reviewable contribution

Explain the trigger, the resulting behavior, and the checks actually run. Attach a desktop/mobile capture for visible changes, and state the network and receipt reference for chain-related evidence. Preserve unrelated changes and commit small, complete tasks with clear English messages.

Use [GitHub Issues](https://github.com/EndPx/proofbill/issues) for reproducible public bugs. Report sensitive ownership, payment or privacy issues through [the security policy](SECURITY.md).
