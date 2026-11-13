# Worker restart and publication recovery

Validated 13 November 2026 using isolated PostgreSQL and real Node process termination. RPC, provider responses and settlement are durable fixtures in this suite; these fault tests do not claim live NEAR AI or testnet fault injection.

## Reproduction

Before the fix, `quick worker restart eventually reclaims an expired active lease` failed: the restarted worker skipped the still-valid lease, and a later claim returned `undefined` after expiry. The old startup-only sweep did not run again. The test changed only the isolated lease clock, not job business state or queue eligibility.

## Behavior after the fix

- Every polling claim considers expired active leases. A restart before expiry waits for the existing lease; a later poll in the same process recovers it without another restart.
- Each claim gets a new fencing token. State/result writes require that token and a live lease. Heartbeats extend active work; a stale process cannot overwrite its successor or restore erased artifacts.
- An interruption before a provider attempt can continue after checking finalized pass/order authorization and the exact request commitment.
- A recorded provider attempt without a saved result becomes `reconciliation_required` with `PROVIDER_OUTCOME_UNKNOWN`. It is not inferred again automatically. The buyer can use the existing contract-authorized refund path.
- Saved, previously verified results are decrypted with the historical buyer context and checked against input salt, request, raw response and evidence commitments. A matching Reserved order can be published without new inference. Matching Delivered/PaymentPending/Paid/TransferFailed state is reconciled without another publication call.
- An ambiguous/transient publication failure retries after a delay, reading finalized chain state first. The contract's order phase and fixed commitments remain payment authority; a local job state does not assert payment success.
- Corrupt/mismatched artifacts or authorization fail closed. A terminal NFT transfer does not give its new holder the historical buyer's private result.

The production lease is six minutes, extended every twenty seconds while owned. An abruptly stopped process may therefore wait up to the remaining lease plus a polling interval before recovery. Transient safe retries wait thirty seconds. Unknown inference requires an actionable review/refund outcome rather than a fabricated successful result.

## Executable checks

With an isolated database named `proofbill_queue_check` and `QUEUE_TEST_DATABASE_URL` configured:

```sh
pnpm test:queue
pnpm test:recovery
```

Fifteen queue tests and sixteen recovery tests passed. Recovery tests cover SIGKILL at claim/reservation/result persistence/publication; restart before and after expiry; continued polling in the same restarted process; unknown provider outcome; failed publication and lost acknowledgement; legacy failed records including already-Paid terminal bookkeeping; heartbeat ownership; stale-process fencing; historical buyer privacy; tampered saved artifacts; transient pre-inference reads; and erasure during a late response.

The test fixture persists provider/reservation/publication/payment counters in PostgreSQL. Successful resumed scenarios assert one provider call and one settlement; unknown-provider scenarios assert no second provider call. Tests advance only the isolated lease timestamp to avoid waiting six minutes. Existing live worker and funded accounts were not used for crash injection.
