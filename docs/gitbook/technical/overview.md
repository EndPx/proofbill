---
description: "Separate financial authority, private execution, and observed history."
---

# Overview

Contract state authorizes financial changes. The worker processes private requests; the API authenticates reads and assembles the workspace. Public receipts deliberately expose only confirmed chain facts and public references.

![Component responsibilities](../assets/system-architecture.png)

*The publisher asserts delivery. The contract does not verify TEE evidence onchain.*

| Component | Responsibility | Detail |
| --- | --- | --- |
| Web and server API | Wallet entry, session, workspace, receipts | [API and Application Data](api-and-data.md) |
| Rust contract | NFT ownership, authorization, budgets, callbacks | [Smart Contract](smart-contract.md) |
| Worker and Python verifier | Queue, inference checks, artifacts, recovery | [Worker and Recovery](worker.md) |
| Neon PostgreSQL | Sessions, encrypted jobs, observed references | [Onchain and Offchain Data](data-storage.md) |
| Buyer-run verifier | Recheck an exported delivery independently | [Verification](verification.md) |

```mermaid
flowchart TB
  O["Owner wallet"] --> W["Web workspace"]
  W --> A["Server API"]
  O --> C["NEAR contract"]
  A --> D["Neon: sessions, encrypted jobs, references"]
  D --> R["Agent worker"]
  R --> N["NEAR AI Cloud"]
  R --> P["Configured publisher"]
  P -->|Delivery statement| C
  C -->|Transfer and callback| S["Seller"]
  C --> V["Public receipt projection"]
  D -->|Public references only| V
```

[Data storage](data-storage.md) separates authoritative records from application rows and observations. [Authorization and Trust Boundaries](authorization.md) explains administrator, publisher, and operator authority before evaluating readiness.
