# ProofBill: three independent blind reviews

Reviewed on 13 November 2026. These are AI mock-judge assessments, not official NEAR scores, a security audit, or a prediction of winning.

All reviewers assessed application snapshot [`c2dc88b50d7cf92b0b57e024578dfe7a0c556b49`](https://github.com/EndPx/proofbill/tree/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49). Later workflow/documentation commits were not regraded.

## Method and evidence boundary

Three fresh-context agents received the public repository, live app, official rules and four track names. They did not receive the builder conversation, an architecture summary, private credentials or access to the builder checkout. Each inspected an isolated public clone. Their lenses were technical correctness, product value, and first-time experience.

All three independently passed frozen-lockfile installation, TypeScript checks, the three TypeScript tests, and the Next.js production build. They checked public app/API behavior and NEAR testnet state; the paid receipt matched an actual successful seller receipt and payment callback. Anonymous private-result access returned HTTP 401. The technical reviewer also checked duplicate-payment rejection and that inspected reservation/delivery transactions used restricted function-call keys.

They did not sign transactions, use a buyer login, run paid inference, or repeat Rust/Sandbox tests. Those parts of the existing integration records remain team-reported evidence. A source-inferred queue issue below was not reproduced. No application fixes were made as part of this review.

Public materials: [app](https://proofbill-two.vercel.app), [workspace](https://proofbill-two.vercel.app/app/purchases), [paid receipt](https://proofbill-two.vercel.app/app/receipts/pass-2-order), [official rules](https://nearhackathon.com/HACKATHON.md).

## Track fit and readiness

Each reviewer used equal weighting across four tracks. This is a convenient synthesis, not the organizer's scoring formula.

| Track | Technical | Product | Experience | Mean /10 |
|---|---:|---:|---:|---:|
| Agent Economy | 6.0 | 6.5 | 7.0 | 6.50 |
| AI Security & Defense | 7.0 | 7.0 | 7.5 | 7.17 |
| Privacy & Private AI | 6.0 | 6.5 | 6.5 | 6.33 |
| NFTs That Do Something | 8.0 | 7.5 | 8.0 | 7.83 |
| Mean | 6.75 | 6.88 | 7.25 | **6.96** |

The unrounded product mean is 6.875. The overall mean is 6.958333, calculated from all twelve track scores.

## Eight-criterion scorecard

| Criterion | Technical | Product | Experience |
|---|---|---|---|
| Commit history | C | C | C |
| Code quality and architecture | B | B | B |
| Documentation | A | A | B |
| Value / problem | B | B | B |
| ICP / audience | B | B | B |
| Metrics / validation | B | F | C |
| Go-to-market | C | C | C |
| Demo / video / deck | B, limited | C | C |

The validation grades emphasize different evidence: the technical reviewer credits implementation verification, while the product reviewer finds no independent customer/demand evidence. These are not contradictory observations. Technical proof exists; traction and willingness to pay have not been established. Do not average the letter grades.

All reviewers saw only three commits at the assessed snapshot, with most implementation in one large commit. They explicitly did not infer copying or a build-window violation. The subsequent small-task workflow records future real progress; history should not be rewritten or padded to influence judging.

## Narrative verdict

The reviewers found a working testnet MVP with meaningful NFT ownership behavior, restricted agent actions, private reads, and receipt-driven payment. NFTs and Security are its strongest track contributions. The financial lifecycle and trust disclosures are more convincing than the current evidence of customer need.

The main presentation gap is that an anonymous judge cannot easily see the complete input-to-output-to-payment journey. Protecting buyer data is correct; a public synthetic example and real demonstration would expose the product's value without weakening those controls. The deterministic single-service worker also supports a narrower agent-commerce claim than a general spending platform.

The reviewers considered it worth further technical examination, but did not establish that it would win. They did not compare the actual competitor pool.

## Priority actions

1. **Reproduce and fix stale queued jobs across NFT transfer.** Source inspection suggests that Alice can queue work, transfer an onchain-Available pass, and leave a failed local row that blocks Bob's new job with `ORDER_ALREADY_QUEUED`. This is an inferred service-availability issue, not evidence of lost principal; refund remains available. Permit atomic supersession only after proving the old job has no onchain reservation and no provider attempt. Keep private ownership boundaries and prevent duplicate execution. Add a targeted queue → transfer → reassignment → new-owner-job integration test. See the [technical report](technical.md) for pinned source references.
2. **Resolve seller economics and validate a specific user workflow.** Buyer access to a Delivered result precedes payment, while the contract permits refund in Delivered. A buyer can therefore retain the information while the seller bears inference cost. This is an acknowledged design tradeoff, not a demonstrated exploit against the hosted app. Choose explicit seller-accepted terms, such as a subsidized internal service or a preauthorized execution fee, before calling it a sustainable marketplace. Test one concrete workload with 3–5 independent paid-API agent developers; record baseline time, confusion, repeat-use intent, and whether transfer/refund matters. Do not count scripted project accounts as customers. See the [product report](product.md).
3. **Publish a complete synthetic walkthrough and align claims.** Link an intentionally public example from the landing page and empty state. Show actual input, useful output, evidence scope, holder approval, successful seller receipt, and the NFT transition. Add an actual demo and the required public demo-post link to submission materials. Reviewers did not find that post in the linked materials; this does not establish that none exists. A pitch deck is not an added official requirement. Align copy with the implemented fixed-price, single-service purchase right. See the [experience report](experience.md).

For Privacy, preserve the explicit trust boundary: the operator processes plaintext, the contract trusts an offchain publisher, and the verifier does not implement every source/image/TLS/NRAS-chain check. A replayable public synthetic evidence bundle with tamper rejection would improve inspectability; do not claim operator-blind or fully trustless inference.

## Full independent reports

- [Technical judge](technical.md)
- [Product judge](product.md)
- [First-time experience judge](experience.md)

Reports preserve the original assessments. Line endings and trailing whitespace have been normalized. Local scratch-clone paths have been replaced with `[isolated public clone]` for publication. The coordinator's synthesis above does not alter the independent grades.
