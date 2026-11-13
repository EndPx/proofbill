# Hosted agent and payment-mode release

Validated 13 November 2026 against [the hosted application](https://proofbill-two.vercel.app), the restricted server worker, NEAR AI Cloud and `proofbill-endpx-2026.testnet`.

## Upgrade and compatibility

The [testnet upgrade record](../../infra/near/agent-payment-upgrade.json) records transaction [Ewhf2nyURERyF16nuDQZU3HgMCA4B8yC5b6f3EXtTqBS](https://testnet.nearblocks.io/txns/Ewhf2nyURERyF16nuDQZU3HgMCA4B8yC5b6f3EXtTqBS). The deployed code hash matched the tested candidate. Four existing passes and four orders were compared before/after: their original fields remained identical, old policies defaulted to Manual and state was not reinitialized.

The database upgrade adds nullable agent identity and an awaiting-reservation state without deleting existing records. The worker was updated with no active jobs. Vercel deployed the web/API from GitHub. The public config now reports `advancedModes: true` after reading contract version 2.

## Live matrix

These are independent purchases by project-owned testnet accounts using synthetic briefs. The external agent is a separate signer from the buyer; its key stays in the agent runtime.

| Agent | Payment | Recorded flow | Final order / NFT |
| --- | --- | --- | --- |
| ProofBill | Manual | [pass-5 report](integration/pass-5-order.json), [receipt](https://proofbill-two.vercel.app/app/receipts/pass-5-order) | Paid / Completed |
| Own agent | Manual | [pass-6 report](integration/pass-6-order.json), [receipt](https://proofbill-two.vercel.app/app/receipts/pass-6-order) | Paid / Completed |
| ProofBill | Automatic | [pass-7 report](integration/pass-7-order.json), [receipt](https://proofbill-two.vercel.app/app/receipts/pass-7-order) | Paid / Completed |
| Own agent | Automatic | [pass-8 report](integration/pass-8-order.json), [receipt](https://proofbill-two.vercel.app/app/receipts/pass-8-order) | Paid / Completed |

All four verified real provider delivery, buyer-only private HTTP access, unchanged NFT ownership, fixed seller payment and duplicate-payment rejection. Attempts by the agent/other account to change owner-only authorization were rejected. Manual cases required the buyer's successful approval transaction; Automatic cases reached Paid through the publisher delivery transaction without a successful owner approval call.

The required response-byte/signature and Intel/GPU preflight checks passed under the declared policy. TLS binding and source-image allowlisting remain Not checked, and NRAS JWT-chain validation is not performed locally. These results do not establish answer accuracy or constitute a security audit.

## CLI and request recovery

A fifth [fresh CLI purchase](integration/pass-9-cli.json) ran the documented `workers/agent/src/run-own-agent.ts` entrypoint. It created a local buyer/revision-bound request, signed the reservation from the external agent, submitted it to the API and reached Paid / Completed without an owner approval transaction. [Receipt](https://proofbill-two.vercel.app/app/receipts/pass-9-order).

CLI replay of pass-8 returned its delivered job without a new reservation. A changed saved buyer failed with `SAVED_REQUEST_AUTHORIZATION_CHANGED`; the provider-attempt timestamp remained unchanged. SDK tests separately reject changed authorization revisions before private task submission.

The [final release smoke](integration/agent-payment-release.json) re-read all five orders from the chain and API. Each had one delivered job, a recorded provider attempt, the expected agent, a Paid order and a Completed NFT held by its buyer. Anonymous private reads returned 401, public responses omitted private artifacts, and no queued/active jobs remained.

## Verification scope

- Eight TypeScript tests, including SDK configuration/challenge and stale-request guards.
- Fourteen real PostgreSQL integration tests for ownership, locking, external preparation/submission, idempotency and refund rejection; chain reads in this suite are controlled fixtures.
- Twenty-two Playwright browser tests, including agent selection, Automatic consent, exact wallet-call arguments and narrow-screen controls. Browser wallets are injected fixtures with no signing keys.
- Seven Rust unit tests and the expanded Wasm/Sandbox financial scenario; publisher statements in Sandbox are synthetic. [Contract evidence](agent-payment-contract.md).
- Typechecking and production builds passed. [Feature CI](https://github.com/EndPx/proofbill/actions/runs/43379047178), [saved-request guard CI](https://github.com/EndPx/proofbill/actions/runs/43380360287).
- A literal-value credential scan of two hosted HTML pages and fourteen public script files found zero matches for configured operator credentials. This is a limited scan, not an exhaustive security assessment.

Hosted signatures and settlement use real project-owned testnet accounts. Clicking through a real browser wallet extension remains a recording rehearsal step. No mainnet transaction or organic-customer validation is claimed.

Manual remains the default. Automatic payment is a bounded advance authorization that trusts the configured publisher's delivery assertion; publisher compromise can trigger that fixed payment without another owner approval. The external SDK currently requires a dedicated agent account FullAccess key for NEP-413 login, kept locally and separate from the owner's wallet.
