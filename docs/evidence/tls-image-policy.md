# Gateway TLS and deployment policy

Implementation and bounded checks, 14 November 2026, Asia/Jakarta. The financial contract, encrypted-artifact format and existing historical order commitments are unchanged.

## Same-socket TLS binding

New inference uses one certificate/hostname-validated HTTPS socket to `cloud-api.near.ai`. Before sending an API credential, it requests a fresh unauthenticated gateway report with `include_tls_fingerprint=true`. After Intel quote, nonce, signer, configuration and event checks pass, it compares the quote-bound SPKI fingerprint with the actual peer certificate observed on that socket. Model attestation, the exact original completion request bytes and signature lookup use that socket. Silent reconnects, absent/mismatched binding, redirects and a lost connection fail closed; a completion is never automatically retried.

The implementation follows the [same-connection requirement](https://docs.near.ai/cloud/verification/cloud-api/tls) and [quote/signer binding format](https://docs.near.ai/cloud/verification/reference/quote-nonce-signer). This authenticates the gateway connection, not an upstream model's TLS hop, model quality or operator-blind confidentiality.

Twenty-one Python tests passed locally. Six added tests cover a real local TLS handshake with a synthetic trusted certificate, credential refusal before authorization, exact-byte POST on the same socket, certificate mismatch, socket replacement/reconnect, redirect refusal, quote/fingerprint tampering and legacy quote distinction. Existing crypto/order/NRAS tests remain green. Local fixtures are not real provider attestation.

A separate live, non-billable check obtained a fresh gateway report without an API key, passed Intel TDX/configuration/event/signer/nonce/SPKI verification and read the model catalog on that same open socket. No model completion or blockchain transaction was requested. This establishes actual gateway bootstrap support; a new paid private purchase is a separate validation step.

## Historical buyer exports

New exports record the observed public peer certificate and its SPKI. The buyer verifier recomputes that SPKI and checks its binding in the signed quote. A buyer cannot re-observe the worker's historical socket, so that conclusion is labelled recorded binding rather than live connection verification. Legacy exports without the TLS record remain supported with no TLS check added. Their original bytes, commitments and scope are not rewritten.

## Deployment image allowlist

New requests enforce [a fixed application-owned policy](../../workers/inference/deployment-policy.json), not an automatically learned list. It accepts the measured gateway and Qwen bootstrap manifests only by exact SHA-256 and service-image inventory. For the dynamically managed Qwen stack it additionally verifies a fresh Compose Manager quote, nonce, configuration, replayed event log, instance identity and canonical action-log hash. The manager image and the latest recorded up/down actions for the selected Qwen proxy, engine and nginx must match approved source revisions/file hashes. A new unapproved manifest, image, source revision, down action or unknown policy fails before a completion request; gateway rejection happens before sending the API key.

The source/file hashes were cross-checked with immutable revisions in `nearai/cvm-compose-files`. `python tools/verify-runtime-source-pins.py` repeats that check against the exact file bytes and selected immutable service images; CI runs it as a policy-review gate. This authenticates and allowlists **recorded deployment intent**, not successful/current execution or model weights. Bootstrap dependency image digests are pinned too. A configured environment-variable default for the manager is not treated as proof of its actual image: the signed manager-start action must name the approved digest.

Three build approvals (cloud-api, cvm-ingress and compose-manager) were cryptographically verified using GitHub/Sigstore attestations. The exact OCI manifests and original bundles are retained in [image-approvals](image-approvals/). Run `node tools/verify-image-approvals.mjs` to re-verify signature/log trust and enforce the exact subject digest, repository, workflow identity, issuer and source revision. CI runs that command; merely finding a record is not approval. Build verification is performed when approving/reviewing the policy, while each inference compares its authenticated measurements against those approved pins.

Full model-image build provenance was **not** independently verified from the public lookups available. The runtime source/digest pins must not be presented as a verified build chain for every model/dependency image. New result checklists therefore distinguish `Deployment image allowlist: passed` from `All model image build provenance: not_checked`.

## Compatibility and policy updates

Twenty-seven Python tests pass, including authenticated-but-unapproved manifests, manager/source changes, forged quote/action/nonce/instance data, terminal down actions, and refusal before completion. The policy also passed against the fresh public gateway and model evidence obtained during the non-billable probe. No policy is imported from an export or caller-provided URL. New exports bind the local policy ID/hash in their committed artifact; the buyer rechecks the locally installed policy. Legacy exports without that field gain no allowlist check.

When NEAR changes a deployment, obtain fresh evidence, review the new measured manifest and runtime source references, verify available build attestations, update the versioned policy and rerun refusal/compatibility tests before rollout. Never approve an observed hash just to make a failing check green. This release does not change the contract policy identifier or rewrite old artifacts; the stronger offchain policy identity is recorded separately.

Keep the original policy/verifier revision for historical exports when approving a later policy version. The current verifier rejects an unknown policy ID/hash rather than importing a policy supplied by the artifact or silently claiming that old evidence passed a different policy.

The application operator still processes plaintext and the contract trusts its publisher. Neither image pins nor TLS binding establishes answer quality, operator-blind E2EE or model-weight provenance.

## Hosted rollout and actual private order

Source `23b62e4` was first staged in a separate server directory. All 27 Python tests and a fresh, non-billable, same-socket gateway/model/NRAS/Compose Manager/allowlist probe passed under the service user and isolated environment before the live checkout changed. CI [43571186591](https://github.com/EndPx/proofbill/actions/runs/43571186591) passed all four jobs, including build-approval/source-pin checks and Rust/Wasm Sandbox. The worker was updated and restarted only after checking the queue was idle; it returned active with no automatic restarts.

One actual synthetic [Manual purchase](integration/pass-14-order-1.json) then completed through the hosted API, worker, provider and NEAR testnet. It funded 0.025 service budget with a 0.100 ceiling and separate storage, reserved `pass-14-order-1`, recorded verified delivery and paid 0.010 after the project-owned buyer's SDK approval. Wrong-owner authorization/payment and duplicate payment were refused. The correct buyer read/export returned 200; another authenticated account returned 404. Private request/response bytes, salt and export remain local and encrypted in persistence, not in the public report.

The current buyer verifier returned `verified: true`, including onchain commitments, exact signed bytes, recorded gateway SPKI/quote binding and the locally approved deployment pins/recorded sources. A copy with altered TLS metadata failed with `ARTIFACT_SERIALIZATION_MISMATCH`. The remaining 0.015 was refunded to the original buyer, preserving 0.025 funded = 0.010 spent + 0.015 refunded. See the [sanitized verification/refund summary](integration/tls-image-policy-pass-14.json) and [public receipt](https://proofbill-two.vercel.app/receipts/pass-14-order-1).

The first local runner had an empty explicit order-ID parameter. Its polling was stopped and the existing funded order was resumed with its exact ID; no second purchase or completion was requested. These are scripted project-owned test accounts and a synthetic brief, not independent customer validation or a human browser-wallet recording. The public report's step list begins at the explicit resume; initial funding/assignment references are included in the summary.

Compatibility was checked against the real legacy export for `pass-13-order-2`: the current verifier returned true for its original byte/signature/TEE checks and did not add a TLS or image-policy check. All 47 production-build browser regressions also passed after the website scope text was updated, including both payment modes and existing wallet/public/private paths.
