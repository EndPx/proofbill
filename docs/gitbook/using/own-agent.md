---
description: "Keep the NFT with the owner and the key in your agent runtime."
---

# Bring Your Own Agent

An external agent uses a dedicated NEAR testnet account. The owner assigns it to the pass, chooses payment policy, and supplies the token ID. The private key stays in the agent runtime; never upload it to ProofBill.

## Integration sequence

1. Authenticate the agent through a one-time message challenge. The current verifier requires a FullAccess key for this dedicated identity; restricted-function-call-key login is not supported by the SDK.
2. Prepare input with the expected buyer, revision, token ID, salt, and nonce. Preparation does not start inference.
3. Independently check the returned commitment and sign `reserve_order` from the assigned agent.
4. Submit the explicit order identity. The API validates the finalized reservation before queuing.
5. Follow delivery. The historical buyer retains private-result and Manual-payment authority.

Persist the intended order ID before reservation. Retries must identify the same purchase instead of silently creating the next numbered order. After ownership/revision changes, archive stale input and prepare a fresh request for the rightful buyer.

## Repository CLI

After installing dependencies, copy `.env.own-agent.example` to an ignored local file and configure a dedicated signer in your environment.

```sh
node --env-file=.env.own-agent.local --import tsx workers/agent/src/run-own-agent.ts
```

The SDK exports `makeAgentBrief` and `runOwnAgent`. Use the [maintained protocol guide](https://github.com/EndPx/proofbill/blob/main/docs/agent-integration.md) for exact interfaces. Do not publish keys, cookies, briefs, or buyer exports in support requests.
