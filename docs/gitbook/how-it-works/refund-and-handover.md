---
description: "Remaining rights move; historical private results do not."
---

# Refund or Hand Over the Remaining Budget

An available pass can transfer between purchases. Its receiver gets the remaining allocation and refund right. The old agent assignment and Automatic authorization are cleared. Active orders and unresolved payments lock transfer.

NFT identity is **contract account + token ID**. `proofbill-endpx-2026.testnet` and `pass-15` identify one NFT. The token ID is not a wallet address; the contract holds and accounts for service funds.

## Refunds close the service budget

A successful refund returns eligible remaining service funds and closes the budget pass. Previous seller payments and retained storage backing are excluded. It is not a partial withdrawal that leaves the same budget open.

For an eligible active order, cancellation/refund includes reserved value as allowed by the contract. PaymentPending does not mean a transfer failed. RefundPending and RefundFailed remain unresolved until their callback or explicit retry completes.

| Recorded pass-15 example | Amount |
| --- | --- |
| Initial service budget | 0.050 NEAR |
| Confirmed seller payment | 0.010 NEAR |
| Remaining service refund | 0.040 NEAR |
| Separate initial storage | 0.030 NEAR, excluded from service refund |

Gas is separate. The paid order remains a public payment record after the pass is refunded. [Open its receipt](https://proofbill-two.vercel.app/receipts/pass-15-order-1).

Private access remains with each historical buyer. Receiving the NFT later does not grant previous briefs, answers, or evidence exports.
