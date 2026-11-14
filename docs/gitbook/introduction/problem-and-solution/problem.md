---
description: "Permission, delivery, and payment are often separate records."
---

# Problem

A developer can give an agent an API key or fund a separate wallet. That provides access, but the owner still needs to understand what the agent was allowed to buy, which result belongs to the request, and whether the intended seller received payment.

## Spending permission needs an execution boundary

A prompt such as “stay within my budget” is not an execution rule. Mistaken retries, changed ownership, or a stale request can mismatch owner intent and agent action.

OWASP recommends independent authorization for consequential agent actions, exact-action integrity, and replay/duplicate protection. This is security guidance, not evidence that ProofBill has prevented measured losses. [Source: OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html).

## Oversight also has a usability cost

Repeated approvals interrupt automation; broad advance permission expands the consequences of mistakes. Anthropic discusses this tension when designing meaningful human control. [Source: Anthropic, Trustworthy agents in practice](https://www.anthropic.com/research/trustworthy-agents).

Our inference is that owners need a deliberate choice between reviewing one delivery and granting bounded permission in advance. This motivates Manual/Automatic; it does not independently validate demand for ProofBill.

## Reconciling payment should not expose the brief

A teammate may need the buyer, seller, amount, policy, and outcome without needing the original input, answer, salts, or provider evidence.

| Existing approach | What remains to connect |
| --- | --- |
| Provider API key and logs | Owner permission, private result identity, and external settlement |
| Separately funded agent wallet | Intended seller, delivery, expiry, and approval policy |
| Manual confirmation for everything | An intentional option for repeated advance-authorized purchases |

The first audience to test is developers in small teams already running paid-API agents. No independent pilot or measured improvement has yet been established.
