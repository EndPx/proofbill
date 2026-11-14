---
description: "Private access is separate from public receipt data."
---

# API and Application Data

The Next.js server checks origin, session identity, and relevant chain authority. The browser receives public configuration and authorized views. Database, encryption, provider, and signing secrets remain server-side.

| Route | Purpose | Access |
| --- | --- | --- |
| `GET /api/config` | Network, public identities, feature flags | Public |
| `GET /api/receipt/:orderId` | Explicit public financial projection | Public; no private job/session read |
| `GET /api/wallet-balance` | Finalized native account total | Public account data |
| `POST /api/auth/challenge` | One-time login challenge | Account-bound request |
| `POST /api/auth/verify` | Verify signature and create session | Valid account proof |
| `GET /api/workspace` | Account workspace | Matching signed session |
| `POST /api/jobs` | Queue hosted-assistant task | Authorized holder/session |
| `POST /api/agent/prepare` / `submit` | External-agent protocol | Assigned agent and checked context |
| `GET /api/private/:orderId` | Private result | Historical buyer’s signed session |

This summarizes responsibilities. Exact request interfaces remain in the [route implementation](https://github.com/EndPx/proofbill/blob/main/apps/web/src/app/api/%5B...path%5D/route.ts) and [agent guide](https://github.com/EndPx/proofbill/blob/main/docs/agent-integration.md).

## Authentication

NEP-413 message signing proves account control without transferring funds. Challenges are one-time and recipient-bound. Eight-hour sessions use an opaque HTTP-only cookie; Neon stores only its hash. Switching wallets must not rewrite an existing session’s identity.

## Failure behavior

Unauthenticated private reads are refused. Wrong buyer, revision, agent, order identity, or origin cannot become valid through a UI change. Loading and retry states avoid invented zero balances or transaction success.
