# Hosted custom budget and optional spending limit

Validated 14 November 2026, Asia/Jakarta, on the hosted application, worker, actual NEAR AI inference and declared NEAR testnet contract. These are synthetic briefs and project-owned accounts, not independent customers.

## Budget and per-purchase authority

The [pass-13 record](integration/flexible-budget-pass-13.json) starts with **1.2345 NEAR service budget**, **0.030 separate initial storage backing**, and an optional **0.100 per-purchase ceiling**. Initial funding was 1.2645 plus gas. The actual service quote remained 0.010; the ceiling was not the price charged.

| Order | Policy | Recorded ceiling | Seller payment | Outcome |
| --- | --- | --- | --- | --- |
| [pass-13-order-1](https://proofbill-two.vercel.app/receipts/pass-13-order-1) | Automatic | 0.100 NEAR | 0.010 NEAR | Paid |
| [pass-13-order-2](https://proofbill-two.vercel.app/receipts/pass-13-order-2) | Manual | None | 0.010 NEAR | Paid |

Both used an external agent signer distinct from the buyer and actual private inference. Between orders, the owner temporarily lowered the ceiling below the quote. A direct signed `reserve_order` transaction failed with `ORDER_PRICE_LIMIT_EXCEEDED`; the assigned agent's API preparation also returned HTTP 409. The service ledger and job count stayed unchanged. The owner then removed the ceiling and chose Manual. The second purchase used an explicit, separately funded storage top-up before reservation. [First integration](integration/pass-13-order-1.json), [second integration](integration/pass-13-order-2.json).

After two payments, **1.2345 funded = 0.020 spent + 1.2145 remaining**. The owner restored a ceiling and Automatic policy, transferred the remaining entitlement, and verified assignment, ceiling and Automatic permission were cleared for the receiver. The former holder's refund was refused; the new holder successfully refunded 1.2145. Final available/reserved balances were zero. Earlier payments and storage backing were excluded. Both earlier order policies/ceilings remained unchanged, including the first order's 0.100 snapshot.

Anonymous public receipts stayed readable. Private reads returned 200 to the authenticated historical buyer, 404 to the new holder and 401 anonymously. Raw inputs, output bodies, salts, signatures, credentials and encrypted exports are not included in this report.

## Tested build and compatibility

The [upgrade record](../../infra/near/flexible-budget-upgrade.json) identifies the exact CI-tested artifact: SHA-256 `44de06a662ad2ca973a7888f62c636b8abf7e94f59578451d8c533d1ded57b90`, **295,956 bytes**, source `a1964b0`, [financial CI](https://github.com/EndPx/proofbill/actions/runs/43503658521). Code was upgraded without initialization. Twelve earlier NFTs and twelve orders retained their fields and policies.

The first post-deploy validator incorrectly inferred historical order mode from the current reusable NFT mode. The saved original block was used to fetch full pre-upgrade `get_order` views and verify every old order against its original state. The corrected operator tool snapshots all views at one finalized block, saves the deploy hash before later assertions, and has two pure regression tests for this scenario. No order policy was rewritten to satisfy the check.

Checks for this release: nineteen native Rust tests, four actual Wasm/Sandbox scenarios, twenty-four TypeScript unit tests, thirty-seven PostgreSQL queue/recovery/retention tests, forty production-build browser journeys and seven Python cryptographic tests. The live UI was inspected at desktop/360px with an injected connection fixture; no browser-wallet signing is claimed. Public APIs, actual SDK signatures, provider requests and testnet callbacks were exercised separately.

Storage is protocol backing and retained history can need further holder deposits; 0.030 is a starting quote, not lifetime storage for every possible purchase. A service refund does not return retained storage. The current service is still private brief extraction. Publisher/operator trust and the declared TEE verification limitations remain unchanged; this is not a security audit, customer validation or mainnet-readiness claim.
