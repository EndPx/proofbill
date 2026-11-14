---
description: "Buyer access and encrypted persistence have explicit limits."
---

# Privacy and Retention

Private artifacts use authenticated encryption bound to the network, contract, order, and historical buyer. Copying ciphertext into another buyer/order context does not create a valid result. API authorization is separate from current NFT ownership.

Public receipts omit plaintext input/output, salts, nonces, ciphertext, and raw provider evidence. Private responses/downloads use no-store caching controls. Workspace responses deny framing and suppress referrer transmission.

The operator handles plaintext during execution and holds operational encryption material. These measures reduce cross-user and accidental public exposure; they do not make the application operator-blind or fully end-to-end encrypted.

## Retention and erasure

The worker records a terminal contract observation before its configured seven-day retention period begins. A fair scan revisits eligible jobs rather than letting old unresolved rows starve newer work. Erasure removes active encrypted payloads while keeping minimal operational/public-reference records.

A buyer can request supported private-artifact erasure. Export needed evidence first. Public chain history cannot be erased. Active database erasure is not a promise that historical backups or independently saved exports have all been destroyed.

| Data | After active artifact erasure |
| --- | --- |
| Encrypted input/result | Removed from the active job row |
| Buyer’s saved export | Controlled by its recipient |
| Chain transactions/commitments | Remain public |
| Minimal job/reference identity | May remain for consistency and history |

The inference child inherits only required credentials; the parent operator remains trusted. [Security policy](https://github.com/EndPx/proofbill/blob/main/SECURITY.md).
