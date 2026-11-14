---
description: "Capabilities implemented in the testnet application."
---

# Features

| Capability | What a user can do |
| --- | --- |
| Reusable NFT budget | Enter a total and make sequential purchases from one pass |
| Optional purchase ceiling | Add or omit an extra maximum per payment |
| Two agent paths | Assign the ProofBill assistant or an external agent account |
| Two payment policies | Choose Manual review or explicit Automatic authorization |
| Buyer-private workspace | Sign a wallet message to inspect private results |
| Independent evidence export | Recheck bytes and recorded evidence locally |
| Public receipts | Share payment facts without disclosing the private result |
| Handover and refund | Transfer available remaining rights or recover unused service funds |

## Permission is not unlimited wallet access

The NFT remains in the owner’s account while the agent uses its own signer. Under the deployed contract rules, the agent cannot take the owner’s key, redirect the seller payment, or bypass the remaining allocation.

## Delivery is not payment confirmation

Pending, failed, paid, and refunded outcomes have separate wording and recovery paths. Automatic does not add a final quality-review gate.

## Current scope

There is one fixed extraction service, seller, and model today. Dynamic pricing, a service marketplace, mainnet support, organizational roles, and an operator-blind application are not implemented. The [Roadmap](../mission/roadmap.md) sets out the planned validation sequence.
