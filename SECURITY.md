# Security policy

ProofBill is an unaudited testnet MVP. The current main branch is the supported development version. This policy does not claim production or mainnet readiness.

## Report a vulnerability privately

Use [GitHub's private vulnerability reporting](https://github.com/EndPx/proofbill/security/advisories/new). Private reporting is enabled for this repository. Do not open a public issue containing an exploit against a live environment, credentials, session cookies or a private buyer artifact.

Include the source revision, affected component, network, minimal reproduction, expected behavior and observed effect. Synthetic data and a local reproduction are preferred. A public testnet transaction reference is useful when it already exists; do not spend funds or access another buyer's data to create a demonstration.

This solo-maintained hackathon project does not offer a paid bug bounty or a guaranteed response time.

## Trust boundaries

- The NEAR contract holds service allocations and enforces ownership, order terms, payment callbacks and refund state.
- Under the deployed code, Manual payment requires holder approval separately from agent reservation. Automatic payment requires an explicit per-pass owner policy and matching publisher delivery. Both modes fix the seller/amount and require a successful transfer callback. Hosted automation uses method-restricted keys; external agent keys stay in their own runtime. Contract-account administrator authority is described separately below.
- The contract trusts the offchain publisher's evidence statement. It does not verify Intel or NVIDIA attestation evidence onchain. In Automatic mode, publisher compromise can trigger the preauthorized fixed payment without a final owner approval.
- The application operator processes plaintext during execution. Encrypted storage and private inference do not make the application operator-blind.
- Response signatures do not guarantee answer accuracy. The current Python verifier authenticates overall and per-GPU NRAS JWT signatures, issuer, validity, nonce and detached-token bindings using NVIDIA's HTTPS JWKS. HTTPS key distribution remains a trust dependency.
- New inference binds the actual gateway peer SPKI to a fresh verified quote on the socket used for the completion, before sending a credential. Reconnects, redirects and failed/missing binding are refused. This does not bind the gateway's upstream model TLS hop.
- A fixed deployment policy allowlists measured bootstrap configurations and authenticated recorded Qwen deployment intent. Selected gateway/manager builds have cryptographically verified source approvals; full build provenance for every model/dependency image and model weights is not established. Unknown deployments fail closed until the policy is reviewed. Existing exports keep their original scope; a buyer cannot independently re-observe a historical worker socket.

## Contract administration

The deployed testnet account `proofbill-endpx-2026.testnet` retained a FullAccess key in a finalized public key-list read on 14 November 2026. Under [NEAR's FullAccess permissions](https://docs.near.org/protocol/accounts-contracts/access-keys#full-access-keys), its holder can transfer NEAR from the account, add/remove keys and deploy replacement contract code. These protocol-level actions do not require the application's order-approval methods. Contract-held service allocations therefore depend on trust in that administrator; the current spending, approval and refund rules are not immutable against the FullAccess holder.

Method-restricted agent/publisher automation keys constrain the transactions those keys can sign. They do not remove the contract account's FullAccess authority, restrict a separate recovery/admin key, or establish who holds any private key. The public key list does not establish custody, storage location or access practices. This submission claims neither renounced administration nor a contract-enforced timelock/multisig protecting that authority.

This administrator trust is separate from trusting the evidence publisher's delivery statement and the application operator's plaintext handling. A normal successful payment receipt establishes what happened under the deployed code; it is not proof that an administrator cannot later control the account. Funding a pass requires accepting this testnet administrator trust.

See [architecture and trust](README.md#architecture-and-trust), [current buyer verification](docs/verify-private-result.md), [TLS/image policy and release](docs/evidence/tls-image-policy.md) and the [privacy-hardening release](docs/evidence/privacy-hardening.md). Dated [probe evidence](docs/evidence/near-ai-response-probe.md) retains its original scope. Environment values belong in secret stores or ignored local files; browser-public variables must never contain database, provider or signing credentials.
