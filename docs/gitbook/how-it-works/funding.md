---
description: "Choose a total budget, an optional ceiling, and an expiry."
---

# Fund a Purchase Pass

Funding creates an NFT and service allocation in the contract. The owner enters a total, can enable a maximum per purchase, and chooses expiry and payment policy. The application defaults to Manual and leaves the purchase ceiling off.

## Three different amounts

| Amount | Meaning | Current example |
| --- | --- | --- |
| Service budget | Total available across repeated purchases | Owner enters 0.050 NEAR |
| Service price | Seller payment for the supported extraction | Fixed at 0.010 NEAR today |
| Optional purchase ceiling | An extra maximum permitted for one purchase | Omitted or a chosen amount covering the current quote |

An omitted ceiling removes that extra limit. It does not make the service free, allow spending beyond the budget, or create variable seller pricing. A ceiling of 0.1 NEAR does not make a 0.010 NEAR service charge 0.1.

## Storage is separate

A new flexible pass starts with at least 0.030 NEAR in storage backing. With a 0.050 NEAR service budget, initial attached funding is 0.080 NEAR plus wallet gas. More backing can be deposited initially or added later as retained history grows. Storage is excluded from service refunds and is not agent spending money.

The testnet contract administrator retains FullAccess authority to move funds or replace code outside the app’s policy. Funding requires trusting that administrator.

Only a successful mint transaction establishes funding. Opening the form, checking consent, or receiving a wallet request does not mean the transaction succeeded.
