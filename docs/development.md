# Development and reproduction

[Back to the project overview](../README.md) · [Contribution rules](../CONTRIBUTING.md)

Setup, checks and operator prerequisites for the current testnet MVP. Local fixtures, Sandbox execution and hosted provider/testnet evidence have separate scopes.

## Local development

**Web preview:** Node.js **24** and pnpm **10.21.0**.

```sh
git clone https://github.com/EndPx/proofbill.git
cd proofbill
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. The landing page and wallet entry can be previewed without production credentials. An unconfigured preview cannot execute a purchase.

**Complete local service:** use your own database, testnet contract/accounts, NEAR AI key/credits, and Python **3.12** environment.

```sh
cp .env.example .env.local
# Fill the server-only values using your own services and accounts.
pnpm env:web
pnpm db:migrate
pnpm dev
```

Generate `ARTIFACT_ENCRYPTION_KEY` as 32 random bytes encoded as 64 hex characters. Use a dedicated Neon database. `pnpm env:web` copies only the web allowlist into `apps/web/.env.local`, excluding worker signing keys and the provider key. Never put credentials in `NEXT_PUBLIC_` variables.

Install [`workers/inference/requirements.txt`](../workers/inference/requirements.txt) in an isolated Python 3.12 environment, set `PYTHON_BIN`, and configure method-restricted agent/publisher accounts. In another terminal, start the worker:

```sh
pnpm worker
```

The worker requires your own provisioned accounts and provider access. No operational keys are supplied by the repository. See [the architecture](planning/TECHNICAL-DESIGN.md), [environment template](../.env.example) and [contribution guide](../CONTRIBUTING.md).

## Checks and reproduction

The [agent/payment release evidence](evidence/agent-payment-hosted.md) records all four hosted combinations, a fresh own-agent CLI purchase, compatibility checks and recovery guards. Manual remains the default; Automatic settlement requires explicit owner authorization for the pass.

The later [recovery/storage release](evidence/recovery-storage-release.md) records restart fault tests, same-token asynchronous transfer regressions, a new hosted purchase and repeated live testnet returns/refund.

```sh
pnpm check
pnpm test
pnpm build
pnpm --filter @proofbill/web exec playwright install chromium
pnpm --filter @proofbill/web test:browser
```

The browser suite builds a production server on port 3215. On Linux, use `playwright install --with-deps chromium`. It covers wallet gating/restoration/disconnect, landing interactions, keyboard FAQ, reduced motion, no-JavaScript readability and accessibility. [CI](../.github/workflows/check.yml) runs these checks without provider or signing secrets and preserves browser failure artifacts.

Queue ownership regression tests use real PostgreSQL row locks and controlled chain fixtures. Create an isolated database named `proofbill_queue_check`, set `QUEUE_TEST_DATABASE_URL`, and run `pnpm test:queue`. Each run creates and removes its own random schema. Never point this test at the application database. CI provisions its own PostgreSQL service. See [the ownership queue regression](evidence/queue-ownership-regression.md) for scope and safety limits.

Run `pnpm test:recovery` with the same isolated database to test actual killed/restarted Node processes, lease fencing, saved-result publication and unknown-provider handling. Its RPC/provider/payment boundaries are durable fixtures, with no paid inference or live signing. See [worker recovery evidence](evidence/worker-recovery.md).

Run `pnpm test:retention` against that isolated database for persistent fair scanning, RPC failure isolation, seven-day erasure and contract scoping. [Retention checks](evidence/retention-fairness.md) cover a Paid job behind more than twenty unresolved records without accessing live private payloads.

Contract CI uses [Rust 1.99.1](../contracts/proofbill/rust-toolchain.toml), checksum-pinned cargo-near 0.22.0 and Ubuntu 24.04. It checks formatting, runs native unit tests, builds the official NEAR Wasm, then passes that exact artifact to Sandbox. Wasm/ABI artifacts are retained in the workflow. Local Linux reproduction:

```sh
cd contracts/proofbill
cargo test --lib
cargo near build non-reproducible-wasm --locked
PROOFBILL_WASM=target/near/proofbill.wasm cargo test --test test_basics --locked -- --nocapture
```

These cover receiver keep/return/failure, transferred refund rights, failed native seller payout and the refund exit. `PROOFBILL_WASM` can select an already-built artifact; the default path builds with cargo-near.

[`workers/agent/src/e2e.ts`](../workers/agent/src/e2e.ts) is an operator integration runner. It uses project-owned account keys, signs real testnet transactions and consumes actual inference credits. It is deliberately excluded from ordinary CI. If interrupted, inspect pass/job state and its `E2E_TOKEN_ID` resume path before creating another purchase. Set `E2E_TRANSFER_MODE=none` for an original-holder purchase, or `E2E_TRANSFER_MODE=unused` (the default) to transfer an unused pass before buying. Both transfer modes finish with private buyer access, confirmed settlement and duplicate-payment rejection. `E2E_AGENT_KIND=proofbill|external` and `E2E_PAYMENT_MODE=Manual|Automatic` select the agent/payment matrix.

## Deployment

- **Web/API:** Vercel project `proofbill`, connected to `EndPx/proofbill`, root `apps/web`, Node.js 24. GitHub is the frontend deployment source.
- **Private persistence:** a dedicated Neon database; database/artifact credentials are server-only Vercel variables.
- **Worker:** a separate non-login Linux user with the [systemd service](../infra/systemd/proofbill-worker.service) and [deployment script](../infra/deploy-worker.sh). Operational keys stay in the worker's private environment; full-access CLI keys are not copied there.
- **Contract:** `proofbill-endpx-2026.testnet`. [Inspect the contract](https://testnet.nearblocks.io/address/proofbill-endpx-2026.testnet) and [deployment record](../infra/near/testnet-deployment.json).
