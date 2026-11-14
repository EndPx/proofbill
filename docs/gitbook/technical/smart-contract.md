---
description: "Financial state is authoritative on NEAR."
---

# Smart Contract

The Rust contract uses `near-sdk` and `near-contract-standards`. It implements NEP-171 core methods, NEP-177 metadata, and NEP-181 enumeration. Purchasing policy adds transfer locks and entitlement-specific accounting.

| Interface | Responsibility |
| --- | --- |
| `create_flexible_budget_pass` | Mint/fund a reusable budget with an optional ceiling |
| `configure_budget_agent` | Save agent, mode, and ceiling at an expected revision |
| `reserve_order` | Check authority and reserve one allocation |
| `publish_delivery` | Accept matching commitments from the publisher |
| `approve_and_pay` | Start buyer-approved payment against the delivery commitment |
| `retry_failed_payment` | Retry an explicitly failed attempt |
| `cancel_and_refund` | Start an eligible service refund |
| `top_up_storage` | Add separate holder-funded backing |
| `get_pass` / `get_order` | Read current budgets and historical order policies |

## Accounting

Funded service value is divided into available, reserved, spent, and refunded allocations. Reservation moves the quote from available to reserved. A successful payment callback moves it into spent. Refund closes the eligible remainder. Storage credit is separate.

Amounts use exact integers: **1 NEAR = 10^24 yoctoNEAR**. Floating-point approximations cannot authorize financial changes.

## Ownership and callbacks

Transfer between orders clears agent/Automatic permission. Transfer-call resolution accounts for ownership rollback and storage credit. Private financial callbacks check the expected phase and attempt, preventing stale outcomes from claiming a newer attempt succeeded.

The contract trusts publisher assertions and retains FullAccess administrator override. It is not an immutable or onchain TEE-verifying escrow. [Rust source](https://github.com/EndPx/proofbill/blob/main/contracts/proofbill/src/lib.rs).
