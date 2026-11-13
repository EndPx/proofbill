# ProofBill web

Next.js App Router web UI/private API. From the monorepo root: `pnpm install`, fill `.env.local`, `pnpm env:web`, `pnpm db:migrate`, then `pnpm dev`.

Wallet connection uses NEAR Connect on testnet and gates the workspace. Public receipts at `/receipts/:orderId` need no wallet. Private data requires the historical buyer's signed NEP-413 session. Manual payment requires buyer approval after delivery; Automatic payment uses explicit owner authorization given in advance for one pass. Failed-payment retries require buyer approval in either mode. Server helpers are behind `src/lib/server.ts`'s server-only boundary. Never put database/provider/signing credentials in `NEXT_PUBLIC_` variables.

The hosted testnet web/API is deployed from GitHub via Vercel's production environment, root directory `apps/web`. The background agent/Python verifier is a separate service. Hosting in a production environment does not imply mainnet readiness. See the root README and ERD for setup and authority boundaries.
