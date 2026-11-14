---
description: "Recheck delivery evidence without trusting its status labels."
---

# Verification

The historical buyer can export a private delivery bundle and run the repository verifier locally. It contains the brief, output, salt, and provider evidence; keep it out of Git and public uploads.

```sh
python workers/inference/verify_export.py /private/path/proofbill-delivery.json
```

Install the repository’s Python requirements first. The verifier needs no wallet/provider key and requests no new completion. It recomputes checks instead of accepting the export’s status labels.

| Layer | Implemented scope | Does not establish |
| --- | --- | --- |
| Order and bytes | Chain identity, commitments, delivered bytes | Answer accuracy |
| Response signature | Recover the attested response signer | Model weights |
| Hardware evidence | Intel TDX/model evidence; authenticated NVIDIA NRAS claims/bindings | Fresh inference now |
| Gateway TLS | Recorded peer SPKI binds to quote; new execution binds the live socket before credentials | Re-observing a historical socket or upstream model TLS |
| Deployment allowlist | Approved measured configurations and authenticated recorded intent | Complete image provenance or actual running weights |

New execution refuses missing/mismatched binding, redirects, silent reconnects, and unapproved deployments. The contract does not perform these hardware/TLS checks; it trusts its publisher.

Network verification uses public chain arguments and hardware/collateral services. Private brief/result bytes are not submitted as a new completion. Service unavailability is not verification success.

Older exports retain their original scope. Missing historical TLS/deployment records cannot be invented retroactively. The [maintained verifier guide](https://github.com/EndPx/proofbill/blob/main/docs/verify-private-result.md) documents exact checks, dependencies, and boundaries.
