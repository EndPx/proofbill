---
description: "Bind the brief, answer, and evidence to one order."
---

# Receive a Private Delivery

Before inference, the request binds the pass, buyer, agent, revision, order identity, salt, and nonce. Reservation records its commitment onchain. The worker checks provider preflight and deployment policy, sends the completion over its bound gateway connection, checks the response signature, and encrypts the buyer’s artifact. The publisher records the response/evidence commitments.

| Public contract record | Buyer-authenticated artifact |
| --- | --- |
| Order/pass identities, buyer, agent, seller | Original brief and output |
| Service amount and payment policy | Salt, nonce, original request/response bytes |
| Request, response, evidence commitments | Provider signatures and attestation material |
| Delivery and payment phase | Detailed check results and their scope |

The operator handles plaintext while executing the purchase. Encryption at rest and buyer access control do not make the application operator-blind or fully end-to-end encrypted.

## Interrupted execution

The worker records a provider-attempt marker before requesting inference. An ambiguous outcome does not authorize another paid request automatically. Recovery reuses durable artifacts when present; otherwise reconciliation or a contract-permitted refund is needed.

A publisher statement records matching delivery commitments. It is not onchain hardware verification or proof of answer quality. [Verification](../technical/verification.md) explains what the buyer can independently recheck.
