---
description: "Who authorizes spending, reads content, or overrides the application."
---

# Authorization and Trust Boundaries

## Ordinary application authority

| Actor | Authority | Boundary |
| --- | --- | --- |
| Current holder | Fund, assign, edit available-pass policy, transfer, request eligible refund | Active orders lock relevant changes |
| Assigned agent | Reserve supported service under the current revision | No seller redirection or owner key |
| Historical buyer | Read/export private result; approve eligible payment/retry | Later holders do not inherit access |
| Configured publisher | Record matching delivery | Contract trusts offchain checks |
| Operator | Run API, worker, encryption, private processing | Handles plaintext |

Automatic grants advance payment authority after publisher delivery, without final quality review. Publisher compromise can trigger that preauthorized payment. Manual keeps explicit initial buyer approval. Both require transfer callbacks.

## FullAccess administrator

The testnet contract account retains FullAccess administration. Its holder can transfer contract-held NEAR, change keys, or replace code through protocol actions outside the app’s approval flow. Funding requires trusting this administrator. Budget rules are not immutable against that authority.

Restricted automation keys constrain their own calls. They do not remove another FullAccess key, prove custody, or establish a contract-enforced timelock/multisig.

## Confidentiality and verification

Encryption and buyer-only reads do not hide runtime plaintext from the operator. Signatures and attestation do not establish answer accuracy, full model-image provenance, or onchain TEE verification.

This is an unaudited testnet MVP. Report vulnerabilities through [private vulnerability reporting](https://github.com/EndPx/proofbill/security/advisories/new); do not publish another buyer’s artifact, hosted exploits, or credentials in an issue.
