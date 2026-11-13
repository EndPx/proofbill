import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { JsonRpcProvider, KeyPairSigner } from "near-api-js";
import { runOwnAgent } from "./index.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const id = "custom.testnet";
const challenge = {
  id: "a".repeat(40),
  nonce: Buffer.alloc(32).toString("base64"),
  recipient: "proofbill.example",
  message: `Sign in to ProofBill.\nNetwork: testnet\nAccount: ${id}\nChallenge: ${"a".repeat(40)}`,
};
function setup(config: object, authChallenge = challenge) {
  let signatures = 0;
  globalThis.fetch = async (url) =>
    Response.json(
      String(url).endsWith("/api/config")
        ? config
        : String(url).endsWith("/auth/challenge")
          ? authChallenge
          : {},
    );
  const signer = {
    signNep413Message: async () => {
      signatures++;
      return {
        publicKey: { toString: () => "fixture-public-key" },
        signature: Buffer.alloc(64),
      };
    },
  } as unknown as KeyPairSigner;
  const provider = {
    callFunction: async () => null,
  } as unknown as JsonRpcProvider;
  return {
    options: {
      baseUrl: "https://proofbill.example",
      contractId: "proofbill.testnet",
      agentId: id,
      signer,
      provider,
      tokenId: "pass-1",
      buyerId: "buyer.testnet",
      revision: 1,
      brief: {
        input: "Order 12 notebooks.",
        salt: "a".repeat(64),
        nonce: "b".repeat(32),
      },
    },
    signatures: () => signatures,
  };
}
test("agent refuses wrong service/network before any signature", async () => {
  const f = setup({
    network: "mainnet",
    contractId: "proofbill.testnet",
    advancedModes: true,
  });
  await assert.rejects(
    runOwnAgent(f.options),
    /AGENT_SERVICE_CONFIGURATION_MISMATCH/,
  );
  assert.equal(f.signatures(), 0);
});
test("agent refuses an authentication challenge for another recipient", async () => {
  const f = setup(
    {
      network: "testnet",
      contractId: "proofbill.testnet",
      advancedModes: true,
    },
    { ...challenge, recipient: "another.example" },
  );
  await assert.rejects(runOwnAgent(f.options), /AUTH_CHALLENGE_MISMATCH/);
  assert.equal(f.signatures(), 0);
});
test("agent refuses an altered login message before signing", async () => {
  const f = setup(
    {
      network: "testnet",
      contractId: "proofbill.testnet",
      advancedModes: true,
    },
    { ...challenge, message: "Authorize an unrelated application" },
  );
  await assert.rejects(runOwnAgent(f.options), /AUTH_CHALLENGE_MISMATCH/);
  assert.equal(f.signatures(), 0);
});
test("authenticated agent still needs an actual assigned pass", async () => {
  const f = setup({
    network: "testnet",
    contractId: "proofbill.testnet",
    advancedModes: true,
  });
  await assert.rejects(runOwnAgent(f.options), /AGENT_NOT_AUTHORIZED/);
  assert.equal(f.signatures(), 1);
});

test("saved request cannot cross to another NFT owner or authorization revision", async () => {
  for (const patch of [
    { owner_id: "new-buyer.testnet", authorization_revision: 1 },
    { owner_id: "buyer.testnet", authorization_revision: 2 },
  ]) {
    const f = setup({
      network: "testnet",
      contractId: "proofbill.testnet",
      advancedModes: true,
    });
    f.options.provider = {
      callFunction: async () => ({
        agent_id: id,
        transfer_pending: false,
        ...patch,
      }),
    } as unknown as JsonRpcProvider;
    await assert.rejects(runOwnAgent(f.options), /PASS_AUTHORIZATION_CHANGED/);
  }
});
