# Gateway TLS and deployment policy

Implementation and bounded checks, 14 November 2026, Asia/Jakarta. The financial contract, encrypted-artifact format and existing historical order commitments are unchanged.

## Same-socket TLS binding

New inference uses one certificate/hostname-validated HTTPS socket to `cloud-api.near.ai`. Before sending an API credential, it requests a fresh unauthenticated gateway report with `include_tls_fingerprint=true`. After Intel quote, nonce, signer, configuration and event checks pass, it compares the quote-bound SPKI fingerprint with the actual peer certificate observed on that socket. Model attestation, the exact original completion request bytes and signature lookup use that socket. Silent reconnects, absent/mismatched binding, redirects and a lost connection fail closed; a completion is never automatically retried.

The implementation follows the [same-connection requirement](https://docs.near.ai/cloud/verification/cloud-api/tls) and [quote/signer binding format](https://docs.near.ai/cloud/verification/reference/quote-nonce-signer). This authenticates the gateway connection, not an upstream model's TLS hop, model quality or operator-blind confidentiality.

Twenty-one Python tests passed locally. Six added tests cover a real local TLS handshake with a synthetic trusted certificate, credential refusal before authorization, exact-byte POST on the same socket, certificate mismatch, socket replacement/reconnect, redirect refusal, quote/fingerprint tampering and legacy quote distinction. Existing crypto/order/NRAS tests remain green. Local fixtures are not real provider attestation.

A separate live, non-billable check obtained a fresh gateway report without an API key, passed Intel TDX/configuration/event/signer/nonce/SPKI verification and read the model catalog on that same open socket. No model completion or blockchain transaction was requested. This establishes actual gateway bootstrap support; a new paid private purchase is a separate validation step.

## Historical buyer exports

New exports record the observed public peer certificate and its SPKI. The buyer verifier recomputes that SPKI and checks its binding in the signed quote. A buyer cannot re-observe the worker's historical socket, so that conclusion is labelled recorded binding rather than live connection verification. Legacy exports without the TLS record remain supported with no TLS check added. Their original bytes, commitments and scope are not rewritten.

## Remaining scope

Source/image approval is separate from TLS binding and hardware attestation. An observed digest or an HTTP 200 is not provenance verification. Until a reviewed policy is accepted and exercised, source-image allowlisting remains unchecked. The application operator still processes plaintext and the contract trusts its publisher.
