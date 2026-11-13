# Why agent purchasing needs a separate control layer

External problem evidence, checked 14 November 2026. These sources describe risks and oversight tradeoffs in agent systems. They are not testimonials, endorsements or validation of ProofBill. No independent ProofBill pilot has been completed.

## The problem has public support

OWASP's [AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html#high-impact-action-integrity-controls) recommends: **“Separate decision-making from execution.”** Its financial-action guidance calls for independent authorization, approval tied to an exact action, replay protection and safe handling of duplicate execution.

Anthropic's [Trustworthy agents in practice](https://www.anthropic.com/research/trustworthy-agents#keeping-humans-in-control) describes a complementary usability problem: **“repeated prompts can become a source of friction”** when tasks require many actions. Its discussion concerns oversight of agents generally, not a test of payment budgets or ProofBill.

Our inference from those sources: users need a deliberate choice between reviewing a specific payment and granting narrow permission in advance. Neither an instruction in a prompt nor an endless series of confirmation dialogs resolves the whole tradeoff. This motivates ProofBill's Manual/Automatic choice; it does not establish demand for our product or certify our implementation.

## A focused first workflow

The initial audience to test is a developer in a small team that already runs an agent against paid APIs. The concrete trial is repeated extraction of short internal purchase briefs into item, quantity and requester fields. ProofBill pays for the extraction service; it does not order physical goods, shop across sellers or negotiate prices.

The budget owner selects total service funding and an optional maximum per purchase. Their assigned agent submits individual briefs without holding the owner's key. Manual mode allows review of each delivered result; Automatic mode authorizes fixed-seller payments after matching publisher delivery. A public receipt lets a teammate reconcile a payment without reading the brief. The original buyer separately authenticates to inspect the private output and response evidence.

This deliberately small service proves the purchasing lifecycle. It is not yet evidence that the extraction output alone justifies the wallet, storage and integration effort.

## Why not use an existing budget or wallet?

| Alternative | What it already does well | What ProofBill adds in this prototype |
| --- | --- | --- |
| Provider API key, usage limit and logs | Simple access and billing within that provider | A contract-linked sequence of owner permission, private delivery commitments and confirmed seller payment |
| Separate agent wallet | Isolates the amount of funds exposed | Fixed seller/quote, expiry, assignment revision, optional per-order ceiling and Manual/Automatic delivery policy |
| Ordinary transferable budget record | Can reproduce the core balance, owner, rules and handover logic | A standard NEP-171 ownership/transfer representation for the remaining entitlement; technical necessity is not claimed |

The contract holds escrow keyed by token ID. The NFT is not an autonomous wallet. An available pass can hand over remaining spending/refund rights between orders, while clearing prior agent and Automatic authorization. Old private results stay with their historical buyer. External marketplace interoperability and demand for team handover remain unproven.

## Economics to validate

The current quote is 0.010 testnet NEAR per extraction, plus separate initial storage backing of 0.030 NEAR and wallet gas. Retained order history may require an owner storage top-up. These are testnet parameters, not a validated commercial price or claim of savings over an API subscription.

In Manual mode the seller incurs inference cost before the buyer decides to pay; a delivered result may be refused. Automatic removes final buyer review and instead trusts the configured publisher's matching-delivery assertion. Neither mode guarantees answer quality. A pilot must ask sellers which policy they accept and compare rejected-job cost with paid-job revenue; no profitable unit economics have been measured.

## First-user acquisition and validation plan

These are planned steps, not outreach already performed or partners secured:

1. Invite five developers already building paid-API agents through founder-led outreach in NEAR Builders and relevant open-source agent communities. Ask permission for a 15-minute test; do not use unsolicited bulk messages.
2. Offer an operator-supported testnet trial using synthetic briefs. Show storage separately from the service total before funding, and let each developer choose a total, optional ceiling and payment mode.
3. Ask them to assign their own agent, complete two purchases, reconcile a public receipt, and choose refund or handover. Record completion, assistance, time, unexpected costs and whether handover was useful. Never collect wallet keys or real confidential briefs.
4. Compare with their existing API-key/budget/logging workflow. Ask what they would replace, who controls the budget and whether they would run a second session without help. Record refusals and confusion as well as positive feedback, publishing only with consent.
5. Treat three of five unaided completions and two explicit requests for another session as an initial decision gate, not statistical market validation. If the wallet/storage effort outweighs the value, narrow the workflow or reconsider the NFT representation before adding services.

Only after that test should we choose a hosted team subscription or disclosed service fee. The present demo charges no platform fee. The next commercial decision depends on repeat-use interest and seller-cost evidence, not the number of testnet transactions.

## What the evidence can establish

| Evidence | Current status | Does not establish |
| --- | --- | --- |
| External security and oversight sources | Linked above | ProofBill adoption, endorsement or measured loss reduction |
| Real provider/testnet lifecycle | [Recorded custom-budget release](../evidence/flexible-budget-hosted.md) | Independent customer usage or mainnet readiness |
| Software behavior | [CI and implementation checks](https://github.com/EndPx/proofbill/actions/workflows/check.yml) | A security audit or removal of publisher/operator trust |
| Demand, handover usefulness and willingness to pay | Not yet tested with independent users | Traction or product-market fit |
