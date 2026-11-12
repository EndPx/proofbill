# Security policy

ProofBill is an unaudited testnet MVP. The current main branch is the supported development version. This policy does not claim production or mainnet readiness.

## Report a vulnerability privately

Use [GitHub's private vulnerability reporting](https://github.com/EndPx/proofbill/security/advisories/new). Private reporting is enabled for this repository. Do not open a public issue containing an exploit against a live environment, credentials, session cookies or a private buyer artifact.

Include the source revision, affected component, network, minimal reproduction, expected behavior and observed effect. Synthetic data and a local reproduction are preferred. A public testnet transaction reference is useful when it already exists; do not spend funds or access another buyer's data to create a demonstration.

This solo-maintained hackathon project does not offer a paid bug bounty or a guaranteed response time.

## Trust boundaries

- The NEAR contract holds service allocations and enforces ownership, order terms, payment callbacks and refund state.
- The holder approves payment separately from agent reservation. Operational agent and publisher keys are scoped to their contract methods.
- The contract trusts the offchain publisher's evidence statement. It does not verify Intel or NVIDIA attestation evidence onchain.
- The application operator processes plaintext during execution. Encrypted storage and private inference do not make the application operator-blind.
- Response signatures do not guarantee answer accuracy. TLS connection binding, an independent source/image policy and local NRAS JWT-chain verification remain outside the implemented verification policy.

See [architecture and trust](README.md#architecture-and-trust) and the [recorded verification scope](docs/evidence/near-ai-response-probe.md). Environment values belong in secret stores or ignored local files; browser-public variables must never contain database, provider or signing credentials.
