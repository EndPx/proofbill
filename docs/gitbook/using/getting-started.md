---
description: "Connect a testnet wallet and sign into the private workspace."
---

# Getting Started

Use a NEAR wallet/account on **testnet**, with native testnet NEAR for service funding, separate storage, and transaction gas. Mainnet funds are not needed. See [NEAR’s network documentation](https://docs.near.org/concepts/basics/networks).

Open the [app](https://proofbill-two.vercel.app/app/purchases), choose Connect wallet, and complete the wallet connection. ProofBill then requests a message signature to verify account control.

| Step | Purpose | Financial action? |
| --- | --- | --- |
| Connect wallet | Select the account | No |
| Sign message | Establish a private session | No gas or spending authority |
| Create and fund pass | Mint and deposit service/storage funds | Separate wallet transaction |
| Assign agent | Authorize a named agent to reserve | Separate owner transaction with gas |
| Approve payment | Start Manual settlement | Separate buyer transaction |

## If sign-in is cancelled

The wallet stays connected. Retry sign-in without reconnecting. If no wallet window appears, inspect the browser’s blocked-popup indicator. A restored valid session skips an unnecessary signature; an expired session returns to sign-in.

The private session lasts eight hours. Login never grants an agent your wallet key or replaces payment approval.
