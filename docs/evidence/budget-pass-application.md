# Reusable budget application checks

Validated locally on 14 November 2026. [Hosted deployment/provider evidence](budget-pass-hosted.md) and subsequent refund/history/recovery checks are recorded separately.

The queue uses scoped order identity and a pass-history index instead of one permanent job per NFT. Per-pass transaction locks protect draft replacement before chain reads; distinct numbered orders preserve earlier buyer bindings. Budget-agent SDK calls require an explicit order ID and current authorization, preventing a completed task rerun from silently purchasing again. The worker retains its lease fencing, single provider-attempt and saved-result recovery rules.

The UI quotes service budget, separate storage backing and total using atomic integers. Invalid amounts disable minting; a changed cap clears Automatic consent. Pass facts and the sidebar distinguish available, reserved, spent and refunded service funds. Historical public receipts use each order's recorded policy independently of later NFT ownership, settings and remaining balance.

Checks: typechecking and nineteen TypeScript tests; thirty-two real PostgreSQL queue/recovery tests; thirty-two production-build browser tests. The budget browser case covers invalid increments, changed-cap consent, exact mint arguments/deposit and 360px layout. Browser/RPC/provider boundaries in these tests are fixtures; no paid inference or live wallet confirmation is implied.

## Landing preview parity, 14 November 2026

The wallet-free preview now uses reusable budget ledgers and the shared funding quote helper. A newly created sample pass can buy repeatedly, choose a sample external agent and grant Automatic authorization. A Paid order leaves its pass Available while funds remain; only exhaustion completes it. Automatic simulation is explicitly triggered as matching delivery rather than a final owner approval. The hero links a real public budget-order receipt; verification limits open directly, and transfer copy describes remaining rights between orders.

Thirty-five browser tests passed, including three purchases on one sample NFT, consent persistence, quote values, receipt navigation, zero preview API mutations, mobile scrolling and accessibility. Desktop, 390px and 320px budget/consent states were visually inspected. All preview records remain labelled sample data; this is UI validation, not a real funded journey.
