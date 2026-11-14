---
description: "Chain state, jobs, and recorded references have different roles."
---

# Data Flow and Indexing

The workspace combines finalized contract reads with authenticated job progress. Balances come from the contract. Jobs supply private tasks/results and worker status. Observations supply useful public transaction references without becoming another financial ledger.

```mermaid
sequenceDiagram
  participant B as Buyer
  participant API as API
  participant DB as Neon
  participant W as Worker
  participant C as NEAR contract
  B->>API: Submit authenticated task
  API->>C: Read current authorization
  API->>DB: Save encrypted buyer-bound job
  W->>DB: Claim with lease token
  W->>C: Reserve or validate reserved order
  W->>W: Inference, verification, encrypted artifact
  W->>C: Publish commitments
  W->>DB: Save progress and public references
  B->>C: Approve Manual payment when applicable
  C->>C: Confirm seller-transfer callback
  API->>C: Read finalized financial facts
  API-->>B: Display payment receipt
```

## Observation is not authorization

`pb_chain_observations` contains application-observed references. It is not an exhaustive general-purpose chain indexer. Missing reference persistence does not invalidate an otherwise readable confirmed order; a saved transaction hash does not prove a successful receiver outcome.

Public receipts read the order and current NFT holder at one finalized block. Database reference queries select public columns only, without loading private payloads or session identity. Pending and failed states remain distinct.
