# ProofBill technical design

Status: proposed interfaces and implementation design. No address, method or service in this document is claimed to exist onchain. Product rights and scope are defined in [PRODUCT-SPEC.md](PRODUCT-SPEC.md).

## 1. Selected architecture

| Component | Owns | Authority boundary |
| --- | --- | --- |
| Next.js/TypeScript web app | Product UI, private API, sessions and encrypted persistence | Can display/project state; cannot establish ownership or payment success |
| NEAR Connect | Wallet connection, message signing and holder transaction prompts | Holder's wallet keeps its own keys; testnet network is explicit |
| Rust ProofBill contract | NEP-171 ownership, service snapshot, allocations, orders and payments | Financial/authorization authority |
| TypeScript agent worker | Claim queued tasks, validate current assignment, reserve orders, orchestrate inference and publish results | Uses restricted operational agent/publisher credentials, never the buyer's key |
| Python inference/verifier helper | Fresh preflight, one exact-byte inference call, cryptographic checks and evidence report | Offchain verifier; Python chosen because `dcap-qvl` already worked in the real probe |
| PostgreSQL | Sessions, private tasks, job leases, encrypted exact-byte artifacts, observational projections | Private application persistence, not a substitute for chain outcomes |

Use a pnpm workspace for actual TypeScript modules, native Cargo tooling for the contract and an isolated Python 3.12 environment for the helper. Pin compatible dependencies during setup; avoid guessing future version numbers. Scaffold the contract with `cargo near new` when implementation starts, then adapt it inside the monorepo.

NEAR Connect's maintained documentation explicitly supports `network: "testnet"` and wallet message signing. Select wallets with the signing features required by the flow. The exact browser/wallet combination is verified in the first slice.

The Python helper runs as a local subprocess of the worker with a versioned stdin/stdout protocol, not a new public microservice. It returns bounded results/evidence; it does not own wallet signing, database migrations or financial transitions. Shared cross-language schemas are language-neutral JSON Schema, with validation at both ends.

## 2. Planned source layout

```text
apps/web/                     UI + private/server API
contracts/proofbill/          Rust contract, native tests, deployment source
workers/agent/                TypeScript purchasing worker and chain reconciliation
workers/inference/            Python inference + verification helper
packages/shared/              public wire schemas, identifiers, contract client inputs
packages/server/              DB/repository + encrypted artifact helpers for two server consumers
docs/planning/                these planning documents
docs/evidence/                reviewed proof of executed slices
design/                      existing image concepts and later approved assets
infra/                        public deployment templates when needed
research/                     existing research; review individually before publication
.deploy-local/                ignored private operational work
deliverables/                 ignored working demo/pitch exports
```

Only create modules when their slice begins. `packages/shared` is browser-safe and imports no service internals or credentials. `packages/server` is explicitly server-only. No extra indexer, API framework, Turbo layer, public SDK or UI package is necessary at the start. Chain reads use RPC and confirmed outcomes; a small reconciler is sufficient for this volume.

## 3. Contract records

All native amounts use canonical decimal integer strings externally and checked `u128`/U128 internally. Timestamp units are explicit (`expires_at_ns`, `reserved_at_ns`). Never derive an amount from JavaScript floating-point arithmetic.

| Record | Fields/responsibility |
| --- | --- |
| Service snapshot | `service_id`, `service_version`, `seller_id`, `model_id`, `price_yocto`, `verification_policy_id`, input/output limits |
| PurchasePass | NEP-171 `token_id`/owner, service snapshot, expiry, `authorization_revision`, assigned `agent_id`, phase, service allocation, optional order ID, pending transfer marker |
| Order | deterministic ID, pass/revision, historical buyer, agent/seller, quote, request commitment, result/evidence commitments, deadline, delivery state, payment state |
| Delivery statement | publisher identity, policy version, supported signature kind, model, exact request/response commitments, evidence commitment |
| Native attempt | pass/order, kind (seller/refund), unique attempt nonce, exact beneficiary/amount, in-flight/succeeded/failed state |
| Storage accounting | paid backing, available storage credit and reserved transfer/rollback backing, separate from service allocations |

The initial service catalog is initialized with one version; already-minted snapshots cannot change. No runtime admin method may redirect existing pass funds or rewrite approved order terms. The initialized verifier publisher identity is disclosed; upgrades are an operator trust boundary, not a hidden production guarantee.

## 4. Pass and order states

Do not collapse inference, ownership and payment into one status string.

**Pass lifecycle**

```text
Available -> In use -> Completed
Available -> Refund pending -> Refunded
In use    -> Refund pending -> Refunded
```

Expiry is an onchain-time condition that disables new use/approval and exposes refund. It does not release an in-flight payment. Transfer-pending is an additional lock, not a financial terminal state. After known failed seller payout, the pass remains locked until explicit retry or refund resolves.

**Order execution**

```text
Reserved -> Running (offchain) -> Delivery published -> Payment pending -> Paid
Reserved/Running/Delivery published -> Cancelled -> Refund pending -> Refunded
Reserved/Running -> Execution failed or Evidence unavailable -> refund action
Payment pending -> Transfer failed -> same-payment retry OR refund action
```

Offchain Running and verifier error states are projections, clearly distinguished from contract state. A callback that is not observed does not equal a failed transfer. UI can show Reconciliation required while financial state stays in flight.

**Per-pass accounting invariant**

`service funded = available + reserved + seller payout pending + refund pending + paid + refunded`

These buckets are disjoint and exactly one holds the fixed service amount for a single-use pass. NFT transfer changes the entitlement owner, not the amount. Dashboard Reserved can aggregate reservation and pending buckets but must explain that those funds are unavailable. Refunds remain visible when reconciling lifetime funded totals.

## 5. Proposed contract interface

Names below are design candidates to freeze against the compiled ABI before client integration; they are not live methods.

| Proposed method | Caller / behavior |
| --- | --- |
| `create_purchase_pass(service_id, expires_at_ns)` | Holder; attach exact service amount plus required storage budget; mint to caller |
| `assign_agent(token_id, expected_revision, agent_id)` | Current holder; only Available/unexpired; increment revision |
| `reserve_order(token_id, expected_revision, request_commitment)` | Assigned agent; zero attached service funds; snapshot buyer/terms and reserve once |
| `publish_delivery(order_id, delivery)` | Configured publisher; exact bound order, policy/model and commitments; immutable delivery once accepted |
| `approve_and_pay(order_id, expected_delivery_commitment)` | Historical/current locked holder; before approval deadline; validate exact tuple and start one native transfer |
| `cancel_and_refund(token_id, expected_revision)` | Entitlement holder; before seller payout starts or after a proven failed attempt; snapshot refund receiver and consume entitlement |
| `retry_failed_payment(order_id, expected_attempt_nonce)` | Locked buyer; only after proven failure; identical recipient, amount and delivery |
| `retry_failed_refund(token_id, expected_attempt_nonce)` | Snapshotted beneficiary; same recipient/amount, proven failure only |
| `on_payment_result` / `on_refund_result` | Private callbacks; unique attempt match; consume one actual promise result |
| NEP-171 core transfer/view/resolver | Current owner only; see transfer boundary below |
| Pass/order/receipt views and pagination | Public facts; no prompt, result plaintext or secret |

Holder-sensitive operations follow appropriate one-yocto authorization conventions where required; that authorization deposit is not seller revenue. Callback methods are private. Client-supplied seller, amount or ownership values cannot override the stored snapshot. A function-call gas allowance does not replace the pass's contract-enforced service amount.

Receipt transaction/receipt references are collected from RPC outcomes and linked to the contract's emitted attempt/order events. Do not invent a transaction hash inside contract state. Contract events identify successful/failed attempts; the reconciler adds chain references, never inventing success from an API response.

## 6. NFT ownership and transfer

Implement the core NEP-171 ownership/transfer surface with metadata and owner enumeration needed for wallet/app display. A general marketplace and Approval Management extension are outside initial scope; owner-controlled transfers are enough.

Direct transfer is allowed for Available/unexpired passes and terminal zero-value passes. It invalidates agent assignment, any private draft delegation and app authorization caches by incrementing a revision. The new holder has the unused service/refund entitlement and must explicitly reassign an agent. Private historical buyer rights do not change.

For `nft_transfer_call`, mark the entire pass as transfer-pending before the external call. No reservation, refund, assignment, spending or nested transfer can proceed until resolution. Use the current standard: receiver result **true returns the token to the prior owner**, false permits it to remain, and receiver failure invokes rollback. Check this against the selected SDK source/tests rather than relying on an older helper's return-value naming.

On rollback restore financial entitlement with NFT ownership; keep app/agent delegation invalidated until the holder reassigns it. The core standard's relevant ownership/approval behavior must remain compliant. Reserve storage for the asynchronous path before it starts; unknown outcomes stay locked rather than being cleared by elapsed time alone.

Storage charges must use actual SDK/network storage accounting. Preserve NFT/order history backing after completion; transferring or completing a pass does not release consumed mint storage into the service balance. Buyer UI shows service price and storage budget separately. Native payout retries cannot spend storage backing.

Metadata exposes public service/seller/value/status/receipt commitment only. Update status metadata from authoritative lifecycle transitions and emit the relevant NFT metadata events. No private title/brief/result is embedded in NFT metadata or media URLs. Terminal NFT transfer does not transfer private history or recreate purchase value.

## 7. Agent and inference flow

1. Authenticated holder creates a private task for its pass/revision. The backend persists an idempotent job; it does not mark the order reserved.
2. Worker leases the job, checks chain owner/revision/agent assignment, constructs unique order context and exact provider request bytes, then submits `reserve_order` using the configured agent identity.
3. Wait for confirmed reservation and compare the recorded terms before inference. A timed-out reservation is reconciled, not sent again as a new order.
4. Python helper fetches fresh gateway and all NEAR model preflight candidates, verifies required evidence, then makes at most one inference attempt for the order. It preserves exact request and uncompressed response bytes.
5. Fetch signature with a short bounded retry, check supported `provider_tee`/ECDSA classification, hashes, recovered signer and unique preflight match. Validate result JSON for display separately from provenance.
6. Required evidence policy passes -> encrypt and persist artifacts -> publisher submits the delivery statement -> confirm it -> expose Review and Pay. Fail/unavailable -> show the reason and refund action.

The request includes order ID, pass ID/revision, service version and fresh task nonce in a defined message context. Record the exact request commitment at reservation. Do not mutate/re-serialize the body after hashing or reconstruct the raw response from parsed JSON. Render structured output separately while preserving original bytes.

Provider API key is seller-side only. Maximum one completion attempt per order; do not retry completion on timeout. A saved successful response can be reverified/re-published without generating another response. Rate-limit by buyer and service, cap input/output, and preserve an ambiguous provider execution state without creating a second charge automatically.

## 8. Evidence policy and bridge trust

Initial required policy: explicit `provider_tee` and ECDSA; canonical supported model/no alias rewriting; non-streaming; verified gateway preflight; every returned model candidate checked; Intel UpToDate/debug disabled/signer+nonce/config/event bindings; GPU evidence accepted through NRAS with matching nonce; exact request/response signature and unique model signer match.

Model unavailability is checked again at implementation. Failure does not silently switch to another model or gateway-only evidence. A supported model/policy change is versioned and explicitly disclosed.

TLS peer-SPKI binding and independent source/image provenance are initially **Not checked**, matching the known probe scope. NRAS result is obtained over authenticated HTTPS; a local JWT chain verifier is not implied. Required-check success does not become a blanket 'fully verified/secure AI' label. Semantic accuracy is a buyer review decision.

The contract trusts its initialized publisher to assert that this offchain policy passed. Owner approval additionally authorizes the exact payment. This is a disclosed application-verifier bridge, not onchain Intel/NVIDIA verification, a decentralized oracle or a TEE-signed NEAR payment. Publisher compromise is a trust risk; it cannot redirect an existing order's seller/amount or spend without holder approval.

## 9. Private state and API boundaries

Private API groups: wallet challenge/session; pass-bound task creation; job status; historical-buyer result/evidence reads; explicit export/erasure. Public API/views: service catalog, public pass state and redacted receipt facts.

Challenge/session: single-use random nonce, short expiry, account/public-key verification against the correct network, recipient/domain binding, secure HTTP-only session cookie and CSRF/origin checks on mutations. Session identity is immutable; changing browser accounts starts a new session. Private responses use no-store caching.

PostgreSQL tables: `sessions`, `tasks`, `jobs`, `artifacts`, `verification_reports`, `chain_observations`. Jobs use unique order IDs and transactional leases. Both worker and API share server-only repositories. A failed HTTP response is not a reason to mint a new pass or order automatically.

Encrypt private artifact bytes with authenticated encryption and server-only key material. Bind order/buyer/artifact type as authenticated context. Store exact bytes losslessly, including provider response whitespace. Public commitments are domain-separated and salted; plaintext hashes/evidence are revealed only in authorized exports. Neither database encryption nor TEE inference hides plaintext from this application's trusted processing components.

## 10. Network, operations and publication

Use explicit network/contract configuration and explorer references. No deployment address or agent/seller account is assumed. Verify account ownership, funding, allowed methods and final ABI during setup before signatures. User wallet/private keys remain with the user. Separate operational agent and publisher credentials, restricting each to its actual methods.

Deployment selection updated by the user: frontend/private API on Vercel through the GitHub repository; PostgreSQL on Neon; the Node worker and its local Python helper on an isolated Linux service. This keeps native verification off the web request path. Vercel holds only the API's server-side secrets; worker signing/provider credentials stay with the worker. Local reproduction remains supported.

Track source, pinned locks, schemas, migrations, setup templates, tests and curated public evidence. Keep real env files, keys, DB dumps, private payloads, worker logs, generated build files and working media exports local/ignored. Review existing `research/` content before any public commit; do not upload an indiscriminate workspace snapshot.

No production server, existing CommitPass service, ShowStake contract or Keyfolio account is stopped or reused by this plan. Mainnet-only Agent Connect/Intents and OutLayer integration are later product decisions, not hidden MVP dependencies.

## Sources

- https://docs.near.org/tools/near-connect
- https://docs.near.org/web3-apps/tutorials/wallet-login
- https://github.com/near/NEPs/blob/master/neps/nep-0171.md
- https://docs.near.ai/cloud/verification/cloud-api/response-signatures
- https://docs.near.org/smart-contracts/security/checklist
- https://nearhackathon.com/HACKATHON.md
