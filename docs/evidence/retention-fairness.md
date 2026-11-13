# Fair retention scanning

Validated 14 November 2026 against isolated PostgreSQL and deterministic chain fixtures. No production payload was erased for this test and no transaction or inference ran.

The former fixed first-twenty scan could repeatedly select unresolved jobs and never observe a later Paid order. The new scan stores a check timestamp before RPC, selects the oldest check/creation times under row locks, and returns only job/order/token identifiers. Scheduling survives worker restart. A per-record RPC failure is logged without private data and does not prevent the remaining checks or already-due erasure. Erasure remains seven days after the first confirmed terminal observation, scoped to the configured contract.

Three real PostgreSQL regressions passed:

- Twenty unresolved records are inspected first; a later Paid job receives a turn on the next invocation using a fresh runtime and acquires its terminal timestamp.
- A failed RPC is rotated, another Paid record becomes terminal, and an already-due payload is erased in the same run.
- A six-day-old terminal payload and another contract's payload remain intact; an unreserved task whose pass was refunded becomes terminal.

Run `pnpm test:retention` with the same isolated `QUEUE_TEST_DATABASE_URL` required by the queue/recovery suites. Each test run creates and removes a random schema. CI includes the suite; do not point it at the application database. These checks prove scheduling and erasure logic with fixture chain reads, not the existence of that backlog in production.
