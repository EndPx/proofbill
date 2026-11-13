# ProofBill delivery plan

State at 13 November 2026: **M0–M5 implemented/validated; M6 hosting and hosted end-to-end purchase validation passed.** See [hosted release](../evidence/hosted-release.md). Human demo-post recording and hackathon submission remain separate user actions, not implied by hosting completion. These results do not imply a production audit or organic adoption.

Historical milestone plan: the Manual-first journey below predates the [own-agent/Automatic release](../evidence/agent-payment-hosted.md), [recovery/storage fixes](../evidence/recovery-storage-release.md) and [anonymous public receipts](../evidence/public-receipts.md). The [product guide](PRODUCT-SPEC.md) describes the current supported flow. Dated milestones and their original acceptance criteria are retained here.

Product decisions: [PRODUCT-SPEC.md](PRODUCT-SPEC.md). Architecture/interfaces: [TECHNICAL-DESIGN.md](TECHNICAL-DESIGN.md). Do not duplicate or quietly change their ownership/payment rules inside task notes.

## 1. Work order and feature milestones

| Milestone | Build | Concrete finish line | Prerequisite |
| --- | --- | --- | --- |
| M0 — Setup and freeze | Check actual runtimes/toolchain, choose supported testnet wallet, create only needed workspace modules, pin compatible dependencies, confirm accounts/ABI/config | Clean-clone setup plan and compiled contract/client interface agree; no fabricated account/address | User authorizes implementation |
| M1 — Product shell | V2 shell, public intro, Purchases, Purchase Passes and pass/task/order/receipt page layouts; wallet connection and network state | User can navigate the complete intended journey on desktop/mobile; samples are explicitly labelled and do not mimic confirmed execution | M0 |
| M2 — Funded NFT rights | Real Purchase Pass mint/funding, metadata, holder assignment, unused transfer, reservation, expiry/refund, native transfer callbacks | Available pass has real testnet state; second holder receives its entitlement; a confirmed refund works; balances remain separated from storage | M0; connect UI from M1 |
| M3 — Agent and private AI | Wallet sessions, encrypted private task persistence, bounded agent worker, confirmed order reservation, Python inference/verifier helper, publisher statement | Actual assigned agent reserves the order; one structured response is returned; exact evidence passes policy; another account cannot read it | M1–M2 |
| M4 — Complete purchase | Exact holder approval, seller payout, callback-driven Paid, Completed NFT metadata, public/private receipt views, explicit export | One complete live testnet purchase reaches the configured seller with inspectable receipt and linked Completed pass | M2–M3 |
| M5 — Focused acceptance | Finite ownership/payment/privacy/tamper checks and one UI/reproduction pass | The matrix below passes with retained evidence; unresolved blockers are explicit | M4 |
| M6 — Demo and submission preparation | Deploy public app if host is available, publishable README/evidence, one concise four-track demo, exact final claims and payload draft | Reviewer can reproduce or watch a complete working journey; no fictional feature/transaction; user reviews final submission material | M5 |

Milestones are dependency order, not a promise of elapsed hours. Deliver a visible outcome after each one. The source layout is proposed until M0; setup must preserve existing research, design and the ignored credential.

## 2. Scope priorities

### Required for the selected four tracks

- One supported testnet wallet and authenticated private session.
- One fixed-price seller/service/model configuration.
- Funded NEP-171 Purchase Pass, unused transfer and dynamic terminal status.
- Real assigned-agent reservation under the pass's rules.
- Actual private inference response, scoped hardware/signature checks and exact-byte preservation.
- Holder approval, confirmed seller payment and one receipt per order.
- Correct unused/cancelled entitlement refund and no duplicated payment.
- Two-account ownership/privacy demonstration.

### After the complete journey works

- Improve responsive spacing, long-value overflow and loading/error copy on the actual path.
- Add a small public read-only receipt page and a concise explanation of trust boundaries.
- Add focused presentation details to the NFT card and timeline, using the existing monochrome shell.

### Deferred

Mainnet, extra assets, renewable/subscription passes, arbitrary sellers/models, NFT marketplace/royalties, token-linked subaccounts, automatic ownerless payout, Agent Connect/Intents funding, OutLayer execution, multisig/team treasury, a separate indexer and broad analytics.

Four-track required capabilities are not silently cut to add more integrations. If a required milestone is blocked, report its exact dependency and continue independent work; do not relabel fixtures as integration proof.

## 3. Bounded verification matrix

Tests belong at the money/ownership/session boundaries and validate independently expected outcomes. Do not write dozens of tests that mirror trivial UI implementation. Sandbox tests exercise actual Wasm state and asynchronous outcomes where needed.

| Check | Expected evidence | Blocks completion? |
| --- | --- | --- |
| Mint/funding/ledger | Service allocation equals quote; storage separate; actual NFT owner and receipt | Yes |
| Unused pass transfer | B gains purchase/refund right; A and A's previous agent cannot reserve/spend/refund; revision changes | Yes |
| Transfer-call keep/return/failure | Standard receiver behavior preserves matching token/fund entitlement; pending path locks relevant actions | Yes |
| One complete order | Assigned agent -> actual provider evidence -> holder approval -> final seller success -> Completed metadata | Yes |
| Policy and replay refusal | Wrong agent/seller/amount, expired permission, repeated order/payment and stale delivery are refused; no extra service spend | Yes |
| Failed native attempt | Proven failure permits one explicit identical retry or refund exit; pending/unknown allows neither duplicate seller transfer nor competing refund | Yes |
| Private result boundary | Unauthenticated and unrelated B cannot read A's result; public receipt/NFT excludes plaintext; old NFT ownership alone does not authorize reads | Yes |
| Evidence integrity | Original saved bytes accepted, changed request/response rejected, missing signature/preflight stays unavailable; fresh preflight precedes actual inference | Yes |
| UI/reproduction | Wallet dismissal, refresh during pending, wrong network, empty state, mobile layout and one fresh setup follow the documented behavior | Yes for broken journey; minor polish may defer |

Run the checks relevant to a slice once. Repeat only when new code changes their behavior, a failure needs validation, or an unresolved issue remains. The final integrated check runs after M4; do not repeatedly audit unchanged passing code. A regression affecting money, ownership, privacy or the demonstrated path is fixed before moving on; other improvements go to the post-demo backlog.

No audit badge or production-ready claim follows from passing this matrix.

## 4. Four-track evidence package

| Track | Required artifact |
| --- | --- |
| `agents` | Agent identity, reservation transaction, order terms and confirmed seller payout |
| `security` | Exact policy/replay refusal outcomes, stale-owner denial and unchanged liabilities |
| `privacy` | Actual scoped provider evidence, authenticated/private read demonstration, encrypted persistence/no plaintext public metadata |
| `nfts` | Mint/transfer transactions, A-to-B entitlement demonstration, terminal metadata tied to confirmed order |

Record commands, source revision/artifact hash, network and relevant public transaction/receipt references with each execution record. Keep raw secrets/private inputs out of Git. Sanitize a synthetic evidence bundle deliberately for public reproduction. Stored diagnostic results never become proof of a new transaction or deployment.

## 5. Demo storyboard

Target approximately 2–3 minutes for a complete understandable story; this is an editorial target, not a claimed event video limit.

1. **Problem, 10 seconds:** 'When my agent buys an AI service, I want to control the budget, inspect the result and know exactly what was paid.'
2. **Purchase Pass, 20 seconds:** Show service, fixed testnet quote and mint confirmation; point to its current owner and funded entitlement.
3. **Functional NFT, 20 seconds:** Transfer an unused pass from A to B. Show B can use it and A no longer can. Use separate browser sessions/accounts so it is understandable.
4. **Agent order, 20 seconds:** B assigns Research assistant and supplies a synthetic private brief. Show actual reservation and execution progress.
5. **Private result/evidence, 30 seconds:** Show useful structured output, required signature/TEE checks and Not checked scopes; demonstrate that another account cannot open the private result.
6. **Approve and pay, 25 seconds:** Show exact seller/amount and wallet approval, then confirmed payment rather than a timer animation.
7. **Receipt and NFT, 15 seconds:** Open chain receipt, show Completed pass and refusal to pay the same order again.

If inference/chain execution takes longer, use clearly labelled cuts in a recording while preserving the actual order/transaction identity. Do not replace provider or chain outcomes with fabricated overlays. A short explanation of offchain verifier trust and operator-held plaintext belongs in the README/evidence, with a concise scope label in the UI.

## 6. Definition of done

The build is ready for submission preparation when:

- A fresh user can follow the documented happy path and see one actual confirmed seller payment.
- NFT ownership materially controls purchase/refund rights; transfer is demonstrated.
- Private result access, actual AI provenance and financial status are distinguished and evidenced.
- The bounded acceptance checks pass and each public claim points to implementation/evidence.
- The app follows the selected dark-frame/rounded-white UI direction without unfinished blocking screens.
- Setup and env templates reproduce the actual modules; native dependencies and operational trust are documented.
- There is a public repository path and human demo-post draft; no invented demo URL, chain address or test credential is filled in.

Product completion and submission are separate actions. This planning request does not authorize account creation, signing, deployment, push/public visibility, posts, paid services or the final application. Use session authorization if later given. The final hackathon payload must be reviewed by the user before submission.

## 7. Release preparation

Current official deadline: **15 November 2026 at 06:59 WIB**. Re-read the live rules before submission. All four track IDs go into one project submission only when supported by the finished build. If a required track feature remains incomplete, disclose it and ask the user about final submission scope; never claim it is done.

The user supplies/approves the real repository, lead/contact data, mainnet prize recipient, demo-post link and consent. Do not invent them. If ShowStake is also entered, reciprocal README disclosures preserve independence. Current rules allow at most two independent projects per person.

Public hosting is the preferred experience. If deployment is externally blocked, finish a reproducible local build and actual video evidence, and state that hosting is unavailable. That fallback does not excuse an incomplete contract/provider journey.

## 8. Small post-demo roadmap

1. **Validate usefulness:** developer feedback on purchase controls, evidence readability, transfer/refund usefulness and willingness to use it again.
2. **Expand one dimension:** additional service or recurring pass after demand is clearer.
3. **Mainnet/business path:** supported mainnet asset and/or Agent Connect, seller economics and team pricing, with separate custody/authorization acceptance.

Do not start the roadmap while the required initial four-track flow remains unfinished.
