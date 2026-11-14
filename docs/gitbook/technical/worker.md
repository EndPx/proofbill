---
description: "Durable execution without blindly repeating inference."
---

# Worker and Recovery

The server worker claims a job with an expiring lease and unique fencing token. Updates require the active lease identity, preventing an expired worker from overwriting a reclaimed job.

Execution rechecks buyer, agent, revision, and chain reservation before using saved private input. A queued request from a former NFT holder cannot become the new holder’s purchase. External-agent preparation waits for its independently signed reservation.

| Last durable boundary | Recovery behavior |
| --- | --- |
| No provider attempt | Resume only after authorization checks |
| Attempt recorded, result unknown | Do not automatically buy another response |
| Encrypted result persisted | Reuse the artifact without another inference |
| Delivery publish interrupted | Reconcile chain commitments before publishing |
| Financial outcome unresolved | Read chain state before showing success |

The provider-attempt marker is saved before completion. A crash after that point can require reconciliation if no artifact exists. Avoiding unintended repeat inference takes priority over claiming automatic recovery for every interruption.

The Python child receives an allowlisted environment with required provider/system settings. It does not inherit database, artifact-encryption, or blockchain-signing keys. This reduces unnecessary exposure; it is not an OS sandbox or protection from the operator.

Job state is operational. A database value such as delivered cannot make a failed seller transfer successful. [Recovery evidence](https://github.com/EndPx/proofbill/blob/main/docs/evidence/recovery-storage-release.md).
