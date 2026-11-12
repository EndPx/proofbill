# ProofBill web

Next.js App Router web UI/private API. From the monorepo root: `pnpm install`, fill `.env.local`, `pnpm env:web`, `pnpm db:migrate`, then `pnpm dev`.

Wallet connection uses NEAR Connect on testnet. Private sessions require a signed NEP-413 message; payments require the holder's wallet transaction. Server helpers are behind `src/lib/server.ts`'s server-only boundary. Never put database/provider/signing credentials in `NEXT_PUBLIC_` variables.

Production is deployed from GitHub via Vercel, root directory `apps/web`. The background agent/Python verifier is a separate service. See the root README and ERD for setup and authority boundaries.
