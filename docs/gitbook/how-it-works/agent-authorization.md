---
description: "Delegate purchasing without transferring the NFT or owner key."
---

# Authorize an Agent

The pass holder selects the hosted ProofBill assistant or an external agent’s NEAR account. The owner signs authorization; the NFT stays in the owner’s wallet. The agent later signs reservations from its own account.

## Why funding and assignment are separate

Minting deposits funds and records the pass policy. Assignment identifies the account allowed to use that permission. The current assignment form also permits policy edits, so it displays the existing Manual/Automatic choice again. It starts with the saved mode; choosing a different mode is not required. Automatic consent is explicitly confirmed for the authorization being saved.

Settings advance the authorization revision. A request prepared against an old owner, agent, or revision must not silently execute under new permission. Execution rechecks these identities before using saved private input.

```mermaid
sequenceDiagram
  participant O as Owner wallet
  participant C as NEAR contract
  participant A as Assigned agent
  O->>C: Assign agent and policy at expected revision
  C-->>O: Record agent and advance revision
  A->>C: Reserve order with request commitment
  C->>C: Check agent, revision, expiry, budget and storage
  C-->>A: Record order and historical buyer
```

The agent cannot redirect the seller payment or sign as the owner. Active orders lock transfer and policy changes. A transfer between orders clears assignment and Automatic authority, so the new holder authorizes their own agent.
