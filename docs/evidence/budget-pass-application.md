# Reusable budget application checks

Validated locally on 14 November 2026. Hosted deployment/provider evidence is recorded separately.

The queue uses scoped order identity and a pass-history index instead of one permanent job per NFT. Per-pass transaction locks protect draft replacement before chain reads; distinct numbered orders preserve earlier buyer bindings. Budget-agent SDK calls require an explicit order ID and current authorization, preventing a completed task rerun from silently purchasing again. The worker retains its lease fencing, single provider-attempt and saved-result recovery rules.

The UI quotes service budget, separate storage backing and total using atomic integers. Invalid amounts disable minting; a changed cap clears Automatic consent. Pass facts and the sidebar distinguish available, reserved, spent and refunded service funds. Historical public receipts use each order's recorded policy independently of later NFT ownership, settings and remaining balance.

Checks: typechecking and nineteen TypeScript tests; thirty-two real PostgreSQL queue/recovery tests; thirty-two production-build browser tests. The budget browser case covers invalid increments, changed-cap consent, exact mint arguments/deposit and 360px layout. Browser/RPC/provider boundaries in these tests are fixtures; no paid inference or live wallet confirmation is implied.
