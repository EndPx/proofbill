# ProofBill hosted MVP release

Validated 13 November 2026, Asia/Jakarta.

- Public app: https://proofbill-two.vercel.app
- Public workspace: https://proofbill-two.vercel.app/app/purchases
- Public receipt from the hosted test: https://proofbill-two.vercel.app/app/receipts/pass-2-order
- Repository: https://github.com/EndPx/proofbill
- Frontend: Vercel project `proofbill`, GitHub source `EndPx/proofbill`, root directory `apps/web`, Node.js 24.
- Private application persistence: the dedicated Neon project, five application tables and five foreign keys.
- Worker: isolated `proofbill-worker` systemd service, non-login user, Node agent plus local Python 3.12 helper. The model runs in NEAR AI Cloud, not on the worker host.
- Contract: `proofbill-endpx-2026.testnet`; actual deployment metadata is in `infra/near/testnet-deployment.json`.

## Hosted flow executed

The [pass-2-order integration report](integration/pass-2-order.json) was produced with `E2E_BASE_URL=https://proofbill-two.vercel.app`. It used actual production HTTP endpoints, project-owned testnet account signatures, the remote worker, actual NEAR AI inference, and NEAR testnet transactions.

The trace includes mint/funding, Alice-to-Bob unused transfer, old-holder refund refusal, Bob's agent assignment, separate authenticated buyer sessions, a real verified model response, buyer-only private read, confirmed seller payment, Completed NFT metadata and duplicate-payment refusal.

Public references:

- Mint: https://testnet.nearblocks.io/txns/CEb8hFrF93mjDcvdhsqXXukd1nBqXoLmx45pTnxthNs3
- Transfer: https://testnet.nearblocks.io/txns/DcJ1hjcBDByvvY6SMgDNyBLBCYbeuYa4uxTaTqSfBt12
- Reservation: https://testnet.nearblocks.io/txns/7L5yX1XcyydLyYdgsApsajWqoPrPUTAjXuCBwv3BusLk
- Delivery: https://testnet.nearblocks.io/txns/6yyj4vxrwoWJzr3tkyaA4P5N3G4TgDZ7JzddcVZdDng8
- Seller payment: https://testnet.nearblocks.io/txns/EKHAhwbEjwJos2sAzc7kxvHAnuA4aYS24H7TmjeeKj5Z
- Duplicate refused: https://testnet.nearblocks.io/txns/68kMbxpYj3uxqekXBnJVwWEqATx2MrcTsTf6ENduXJZ1

## Hosting and browser checks

- Anonymous production homepage and `/api/config` returned HTTP 200.
- Public config exposed only testnet network, contract ID, agent ID and configured status.
- Production desktop receipt displayed chain-confirmed Paid while keeping the result locked for an unauthenticated browser.
- Production mobile pass form was inspected at 390px; document width was 390px, with no horizontal document overflow.
- Development instrumentation did not appear in the production page.
- Two production HTML pages and nine referenced public JavaScript files were compared locally against configured credential values: zero literal matches. This is a scoped check, not a security audit.
- Vercel's database/artifact configuration is server-side. Worker provider/signing credentials are not configured in the web environment. Full-access CLI keys were not transferred to the worker.
- PostgreSQL uses explicit TLS certificate verification (`rejectUnauthorized: true`); the local connection check succeeded. The worker health command checks both database TLS and operational method scopes.

Screenshots: [desktop receipt](ui/production-receipt-desktop.png), [mobile pass form](ui/production-pass-mobile.png).

## Limits

The end-to-end signatures were generated through the SDK with locally owned testnet demo keys. The browser wallet selector was inspected, but no human's financial wallet confirmation was automated. The initialized publisher remains a trusted application verifier. TLS connection binding, independent source/image policy and local NRAS JWT-chain verification remain outside the stated evidence policy. No audit, mainnet readiness, organic users or measured business impact is claimed.
