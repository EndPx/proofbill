# Privacy hardening without a financial protocol change

Checked 14 November 2026, Asia/Jakarta. These changes keep the NFT, payment methods, order IDs, encrypted artifact format and publisher policy identifier intact. They do not make the application operator blind to plaintext or move TEE verification onchain.

## Authenticate NVIDIA results locally

Previously, the worker decoded the overall NRAS JWT through authenticated HTTPS and checked its nonce/result without local JWT signature verification. The updated shared Python verification path uses pinned PyJWT and ES384, NVIDIA's [official fixed JWKS endpoint](https://docs.api.nvidia.com/attestation/reference/keys), required issuer/time/nonce checks and SHA-256 binding of all detached GPU tokens. Both overall and per-GPU JWT signatures must verify. Attacker-supplied key URLs are ignored; redirects, missing/ambiguous keys and invalid tokens fail closed with a fixed error code.

The worker applies this check during preflight before requesting a completion. The buyer-run verifier applies it when independently checking a saved export. Historical encrypted exports and their commitment bytes are unchanged. New deliveries include an explicit NRAS JWT check; old saved check labels are not upgraded retroactively.

Validation: fifteen Python tests with adversarial subcases passed locally, including signature forgery, HS256/none algorithm confusion, altered issuer/nonce, expiry/future timestamps, missing claims, substituted/removed GPU tokens, key-fetch failure and preflight refusal before inference. Mocked fixtures establish parser/cryptographic refusal behavior, not actual hardware execution.

A separate non-billable network check resubmitted the already-public synthetic probe's NVIDIA hardware payload to NRAS, then verified the resulting overall and eight per-GPU JWTs against NVIDIA's live HTTPS JWKS. Signatures, issuer/time, nonce and detached-token digests passed. This ran no model completion, used no application/provider credential and signed no blockchain transaction. It is NRAS re-verification of recorded hardware evidence, not a fresh deployment attestation or a new paid private purchase.

Remaining boundaries: HTTPS still supplies trust in NVIDIA's key distribution; gateway TLS certificate binding and source-image allowlisting are not implemented. Operator plaintext access and the trusted offchain publisher remain unchanged. See [buyer verification](../verify-private-result.md) for the current verification scope.

## Minimize inference-process credentials

The worker now constructs a small allowlisted environment for Python rather than inheriting the entire worker environment and deleting five known secrets. The child receives the NEAR AI key, required OS/locale/cache settings and configured certificate paths. It receives no database credential, artifact-encryption key, agent/publisher/owner key, unrelated future secret, SSH agent socket or Python module-injection setting. User-site imports and bytecode writes are disabled. The parent environment is unchanged; the worker retains its normal database, signing and encrypted-persistence responsibilities.

Two unit tests verify the exact inherited set, omission of synthetic secret markers and preservation of Windows variable casing. This limits unnecessary credential exposure to the subprocess; it is not an OS sandbox or protection against the application operator.

## Protect browser/API delivery

API JSON responses and authenticated evidence downloads share private/no-store/max-age=0, legacy no-cache/expiry headers and a Cookie cache variant. The same protections apply to authentication refusals and errors. Workspace/API routes suppress referrer transmission, disable content sniffing and deny framing. No script/connect-source restriction or cross-window isolation header is introduced, preserving the existing wallet-connection mechanism. Public receipt pages remain outside the wallet gate.

Two production-build browser tests check session/private/export refusal headers, cross-origin job refusal without echoing a synthetic brief, anonymous job refusal, workspace frame protection and anonymous public receipt access. The full wallet/policy/preview/receipt regression suite remains the compatibility check; this is browser response protection, not end-to-end encryption.

## Hosted worker compatibility

The server worker was updated to source `dd8661f` after checking that all fourteen existing jobs were delivered and none was queued/claimed/running/publishing. Dependencies were installed before updating the Python files. Fifteen Python tests passed on the server. Under the actual allowlisted subprocess environment and service user, the full saved public gateway/model preflight passed Intel TDX, event/configuration/signer/nonce bindings and authenticated NRAS overall/per-GPU checks. No completion was requested. The worker was restarted after checking the idle queue again and returned active.

All 47 production-build browser regressions passed locally, including wallet restoration/cancellation, both payment modes, own-agent configuration, custom budgets, public/private boundaries and the new HTTP protections. Both new HTTP tests also passed against the public Vercel deployment. Existing encrypted result bytes, database schema and onchain financial state were not migrated or rewritten. This establishes compatibility at those boundaries; a new paid private order and human wallet signing were not replayed during this hardening release.
