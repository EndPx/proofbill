# Bring your own agent

Choose the built-in ProofBill assistant or a dedicated NEAR account controlled by your own agent. The NFT stays in the owner's wallet. Each pass binds one service, seller, amount and expiry.

Version 4 adds custom total budgets and an optional per-purchase ceiling. A total must cover the current 0.010 testnet NEAR quote, but need not be a price multiple and has no 1 NEAR ceiling. An absent ceiling means no extra price cap; every order must still fit the fixed quote and available allocation. `configure_budget_agent` lets the holder change assignment, mode and ceiling between orders, advancing revision. Mode/ceiling snapshots on earlier orders do not change. V3 and single-use passes retain their original behavior.

Starting storage backing is at least 0.030 NEAR, independent of the chosen service total. More backing can be funded initially or through holder-signed `top_up_storage`. The public pass view quotes `storage_required_for_order_yocto`; API/SDK preparation refuses a new order until that deficit is covered. An owner top-up never consumes service budget. Between orders it refreshes revision, so archive/resubmit any unreserved saved request afterward; active-order backing does not change its authorization. Actual history growth can need further deposits. This is separate storage backing, not an additional price chosen by the agent.

## Owner setup

1. Fund a Purchase Pass. Manual payment is the default. Automatic payment requires explicit consent to its seller, amount and delivery trigger.
2. Open the pass, select **My own agent**, enter its NEAR testnet account, choose the payment policy and sign **Assign my agent**.
3. Give the pass ID and brief to your agent. Never upload either wallet's private key to ProofBill.
4. Manual mode requires **Approve payment** after reviewing the result. Automatic mode uses the owner's advance authorization after matching publisher delivery.

Changing settings is owner-only, only while Available, and increments the authorization revision. An unused NFT transfer clears both agent assignment and Automatic permission. Active orders lock transfer and policy changes. Historical buyer access does not follow a completed NFT transfer.

## Run an agent locally

After `pnpm install`, copy [.env.own-agent.example](../.env.own-agent.example) to ignored `.env.own-agent.local`. Use a dedicated agent account with only its required gas balance. Keep the key and brief on that machine.

```sh
node --env-file=.env.own-agent.local --import tsx workers/agent/src/run-own-agent.ts
```

The command stores the expected buyer, authorization revision, private input, salt and nonce under ignored `.local/own-agent/` before reserving. A saved request fails closed after the owner or authorization changes. Archive the old file and provide a fresh brief for the new authorization; the CLI never silently reuses another buyer's brief. Reuse that file after an interruption. Inspect the onchain order before retrying an unknown transaction outcome. Console output contains public order/status/transaction identifiers only.

The [Node/TypeScript SDK](../packages/agent-client/src/index.ts) exports `makeAgentBrief` and `runOwnAgent`. Supply the signer, NEAR RPC provider, expected `buyerId` and `revision` from your agent runtime. The key never travels over the API.

For a budget pass, also supply an explicit `orderId`: the active `pass.order_id`, or `nextOrderId(pass)` from `@proofbill/shared` for an intentional new purchase. Persist that ID with the buyer, revision, salt and nonce before reserving. The SDK rejects an omitted or stale order ID rather than silently buying again. Successful settlement increments the pass revision; refresh the pass before creating a new task. The CLI stores this context in its existing local request file. After confirming a task is complete, deliberately archive that file before starting another purchase on the same pass. Rerunning a stale request is not a command to spend the next allocation.

`POST /api/agent/submit` accepts `orderId` with `tokenId` so retries identify the same reservation. A repeated completed submission does not enqueue another inference. Budget handover clears agent assignment and Automatic permission and moves only the remaining service/refund rights. Earlier private results stay with their recorded buyers.

## Protocol

1. Authenticate through the existing one-time NEP-413 challenge/session endpoints. The SDK checks the challenge account, recipient, network, nonce and message before signing.
2. `POST /api/agent/prepare` with `tokenId`, `revision`, `input`, `salt` (32-byte hex) and `nonce` (16-byte hex). Only the assigned external agent is accepted. The server encrypts the brief for the buyer and returns reservation arguments. Inference has not started.
3. Independently compute the canonical request commitment using the shared request format. Verify the returned commitment and sign `reserve_order` from the agent account with the expected revision and zero attached deposit.
4. `POST /api/agent/submit` with `tokenId`. The API checks the finalized reservation's agent, buyer, revision, token, seller, amount and commitment before queuing. Repeated submission is idempotent; unknown execution is not success.
5. The operator worker processes the already-reserved request, verifies response evidence, encrypts the result for the buyer and publishes delivery. It never signs on behalf of the external agent.

Direct clients use the session cookie returned by `/api/auth/verify` and the application origin in the `Origin` header. Preparation returns public job/reservation fields only. Agents cannot read `/api/private/:orderId` unless they are also the historical buyer.

## Payment authority and trust

Manual mode requires an owner approval transaction. Automatic mode is advance authorization for this single pass. The contract starts payment after its configured publisher records delivery matching the reserved request and model/policy. It trusts the publisher to assert the offchain checks; it does not verify TEE signatures onchain. Evidence does not guarantee answer quality. Publisher compromise can trigger an Automatic pass's fixed payment without another owner approval. Manual remains the default.

Both modes mark Paid only after a successful seller-transfer callback. Failed payouts become TransferFailed with owner retry/refund paths. Expired passes cannot start Automatic payment. Agents cannot redirect the seller, increase the amount or spend twice.

Read-only public receipts at `/receipts/:orderId` need no wallet. They identify the historical buyer separately from the current NFT holder. Private results and verification bundles require that buyer's signed session; transferring a Completed NFT does not transfer private access. Failed-payment retries require the buyer's wallet approval even when the initial payment policy was Automatic.

The current NEP-413 account-ownership verifier requires a FullAccess key for the dedicated agent account. Restricted-function-call-key login is not supported by this SDK version. This account is separate from the owner's wallet and its key stays in your runtime. Hosted agent and publisher operational keys remain method-restricted.

The operator integration runner accepts `E2E_FLEXIBLE_BUDGET` as a decimal NEAR total and optional `E2E_MAX_ORDER_PRICE`. It must target the declared project testnet accounts. `E2E_STORAGE_TOP_UP=yes` explicitly permits the buyer-side runner to add only the quoted storage deficit; no agent key receives permission to take storage funds from the owner's wallet. Budget resume still requires an explicit `E2E_ORDER_ID`. It signs real testnet transactions and consumes inference credits; it is not part of ordinary CI.

Policy entries use an additional storage prefix without changing existing Borsh root/pass/order layouts. An absent entry means Manual, preserving existing passes on upgrade.
