---
description: "Public addresses and a completed purchase/refund example."
---

# NEAR Testnet

| Setting | Value |
| --- | --- |
| Network | NEAR testnet |
| Website | [proofbill-two.vercel.app](https://proofbill-two.vercel.app) |
| Workspace | [Purchases](https://proofbill-two.vercel.app/app/purchases) |
| Public receipt | [pass-15-order-1](https://proofbill-two.vercel.app/receipts/pass-15-order-1) |
| Current service | Extraction at 0.010 native testnet NEAR |
| Initial flexible-pass storage | At least 0.030 NEAR, separately funded |

## Active Contracts and Addresses

| Role | Public address |
| --- | --- |
| NFT/purchasing contract | [proofbill-endpx-2026.testnet](https://testnet.nearblocks.io/address/proofbill-endpx-2026.testnet) |
| Hosted agent | [agent.proofbill-endpx-2026.testnet](https://testnet.nearblocks.io/address/agent.proofbill-endpx-2026.testnet) |
| Delivery publisher | [publisher.proofbill-endpx-2026.testnet](https://testnet.nearblocks.io/address/publisher.proofbill-endpx-2026.testnet) |
| Seller | [seller.proofbill-endpx-2026.testnet](https://testnet.nearblocks.io/address/seller.proofbill-endpx-2026.testnet) |

`pass-15` identifies a token inside the contract, not an independent wallet. FullAccess administrator authority remains; [read its consequences](../technical/authorization.md).

## Completed Manual cycle

The finalized pass-15 example funded 0.050 NEAR of service value, paid 0.010 NEAR, and refunded 0.040 NEAR. Its separate storage and gas are excluded. The order is Paid while the pass is Refunded. Its expiry was three days.

The [README table](https://github.com/EndPx/proofbill#one-complete-onchain-cycle) supplies six full transaction hashes. [Public RPC evidence](https://github.com/EndPx/proofbill/blob/main/docs/evidence/integration/pass-15-cycle.json) contains no private content. Successful transactions do not establish an explorer source-verification badge.
