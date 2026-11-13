# Queued purchase ownership regression

Validated 13 November 2026.

## Reproduction

The pass can remain Available while its offchain job waits. Alice queues a brief at revision 1, transfers the unused NFT to Bob, and Bob assigns an agent at revision 3. The deterministic order ID still refers to Alice's queued row. Previously, `ON CONFLICT DO NOTHING` returned `ORDER_ALREADY_QUEUED` for Bob, including after the worker rejected Alice's stale authorization.

A real isolated PostgreSQL 18.6 database reproduced both conflicts before the fix: the original-holder control passed, while both recipient tests failed with `ORDER_ALREADY_QUEUED`. Chain reads in this suite are controlled fixtures; this reproduction does not claim a live blockchain race.

## Correction

The API locks the existing row and checks current finalized pass ownership, authorization revision, assignment, expiry, transfer status and absence of an onchain order. A newer authorization may replace only an unstarted queued or failed intent. The new buyer supplies a fresh brief, salt and nonce, encrypted with that buyer's authenticated context. The previous brief is overwritten; it is never handed to the recipient.

The existing job identity is retained. No schema migration, contract reset or payment action is required. Claimed jobs, non-null leases, reservation commitments, provider attempts, results and terminal/erased records cannot be reset. They require reconciliation. The worker still checks buyer and revision before reservation, and the contract checks the expected revision again.

## Executable checks

`pnpm test:queue` uses the actual API queue service and worker claim query against real PostgreSQL, including competing transactions and `FOR UPDATE SKIP LOCKED`:

- Original owner queues without any NFT transfer; duplicate submission fails.
- Recipient replaces an unstarted queue entry and supplies a fresh private brief.
- A stale authorization failure before reservation can recover.
- Same-holder agent reassignment follows the same revision rule.
- Twelve unsafe state/marker combinations remain immutable.
- Recipient must assign the agent; pending, expired and reserved passes fail closed.
- Concurrent recipient requests create one intent; competing workers claim it once.
- A worker claim prevents recipient replacement until the stale job safely fails.
- A worker skips the recipient's locked row, then claims the new buyer's intent after commit.
- Ciphertext rejects both cross-buyer decryption directions; old-buyer lookup no longer finds the rebound intent.

The suite uses synthetic briefs and a generated encryption key. It does not call NEAR AI, sign wallet transactions, or change production application data. Hosted execution is recorded separately below; it does not turn the controlled race reproduction into a live blockchain race.

NFT transfer is optional. The basic demo can fund a pass, assign an agent, run a task, inspect the private result and approve payment without changing owners. An unused transfer demonstrates delegation; an active onchain order locks transfer.

## Hosted demo checks

The queue fix was released in commit `c93cbda`. [CI run 43373425295](https://github.com/EndPx/proofbill/actions/runs/43373425295) passed typechecking, unit tests, nine PostgreSQL queue tests, the production build and eighteen browser tests. Vercel deployed it through the GitHub integration, and the server worker was updated while no queued or active jobs were present.

The [original-holder integration report](integration/pass-3-order.json) records a hosted purchase without any NFT transfer. Bob funded the pass, assigned the agent, authenticated by wallet-message signature, received a NEAR AI result through the server worker, read it privately and approved payment. Alice's private read was rejected; a second payment was rejected. The order ended Paid and the NFT Completed.

- [Original-holder receipt](https://proofbill-two.vercel.app/app/receipts/pass-3-order)
- [Confirmed payment](https://testnet.nearblocks.io/txns/5h99Ue5B1B46o2hVwAeQ4KkymfYLCJkKnLcps9bFY8vV)

The [unused-transfer integration report](integration/pass-4-order.json) records Alice funding and assigning a pass, transferring it to Bob, and losing the old assignment at revision 2. Alice's refund attempt was rejected. Bob assigned the agent at revision 3, submitted a fresh brief, privately inspected the NEAR AI delivery and approved payment. That order also ended Paid and the NFT Completed; duplicate payment was rejected.

- [Transferred-pass receipt](https://proofbill-two.vercel.app/app/receipts/pass-4-order)
- [Unused NFT transfer](https://testnet.nearblocks.io/txns/4FQAVVyDzsg3dkMphE7SdKp65heKU4nFLXPYzCKQfRct)
- [Confirmed payment](https://testnet.nearblocks.io/txns/5SD6eEPD8nHsrpuwFpjBwi3vBgLU5ACZ2JAwRiDDhZuu)

These are scripted project-owned testnet accounts and synthetic briefs. They prove the hosted API, restricted worker, provider and settlement path. The queued-transfer race uses controlled chain fixtures in isolated PostgreSQL. The script does not operate a browser wallet extension; wallet confirmation clicks remain part of the recording rehearsal.

For the main demo, use: connect wallet -> fund a Purchase Pass -> assign agent -> submit brief -> unlock and inspect result/evidence -> approve payment -> open receipt. Use transfer as a short optional second flow: transfer an Available pass -> recipient assigns agent -> recipient submits their own brief. A completed NFT remains a receipt; the historical buyer retains private-result access.
