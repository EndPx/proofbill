---
description: "From funded permission to private delivery and public receipt."
---

# Overview

The owner funds a pass and assigns an agent. The agent reserves one service allocation, the worker obtains and checks a response, and the publisher records delivery commitments. Manual approval or the Automatic policy starts settlement. A successful transfer callback establishes payment.

![Purchase journey](../assets/purchase-journey.png)

*Product journey. The two payment paths converge on confirmed settlement.*

```mermaid
flowchart TB
  A["Owner funds a Purchase Pass"] --> B["Owner assigns an agent"]
  B --> C["Agent reserves one order"]
  C --> D["Worker obtains and checks private delivery"]
  D --> E["Publisher records delivery commitments"]
  E --> F{"Payment policy"}
  F -->|Manual| G["Buyer reviews and approves"]
  F -->|Automatic| H["Advance authorization applies"]
  G --> I["Seller transfer and callback"]
  H --> I
  I --> J["Public payment receipt"]
  J --> K["Buy again, hand over, or refund remainder"]
```

| Stage | What changes |
| --- | --- |
| [Funding](funding.md) | A service allocation and separately backed NFT are created |
| [Agent authorization](agent-authorization.md) | One agent and a fresh revision are recorded |
| [Private delivery](private-delivery.md) | Request, response, and evidence link to one order |
| [Settlement](settlement.md) | The seller transfer succeeds or keeps an unresolved/failure state |
| [Refund and handover](refund-and-handover.md) | Remaining rights close or move without rewriting previous buyers |
