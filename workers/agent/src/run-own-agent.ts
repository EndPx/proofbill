// Run from the workspace root with an ignored env file; never send keys to the API.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { runOwnAgent, makeAgentBrief } from "@proofbill/agent-client";
import { KeyPairSigner, JsonRpcProvider } from "near-api-js";
const { OWN_AGENT_ID, OWN_AGENT_KEY, PURCHASE_PASS_ID, PRIVATE_BRIEF_FILE } =
  process.env;
if (
  !OWN_AGENT_ID ||
  !OWN_AGENT_KEY ||
  !PURCHASE_PASS_ID ||
  !/^pass-[0-9]+$/.test(PURCHASE_PASS_ID) ||
  !PRIVATE_BRIEF_FILE
)
  throw new Error("OWN_AGENT_CONFIGURATION_REQUIRED");
const rpc = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });
const pass = (await rpc.callFunction({
  contractId: "proofbill-endpx-2026.testnet",
  method: "get_pass",
  args: { token_id: PURCHASE_PASS_ID },
  blockQuery: { finality: "final" },
})) as {
  owner_id: string;
  authorization_revision: number;
  agent_id: string | null;
} | null;
if (!pass || pass.agent_id !== OWN_AGENT_ID)
  throw new Error("AGENT_NOT_AUTHORIZED");
await mkdir(".local/own-agent", { recursive: true });
const saved = `.local/own-agent/${PURCHASE_PASS_ID}.json`;
let request: {
  buyerId: string;
  revision: number;
  brief: ReturnType<typeof makeAgentBrief>;
};
try {
  request = JSON.parse(await readFile(saved, "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  request = {
    buyerId: pass.owner_id,
    revision: pass.authorization_revision,
    brief: makeAgentBrief(await readFile(PRIVATE_BRIEF_FILE, "utf8")),
  };
  await writeFile(saved, JSON.stringify(request), { mode: 0o600 });
}
if (
  request.buyerId !== pass.owner_id ||
  request.revision !== pass.authorization_revision
)
  throw new Error("SAVED_REQUEST_AUTHORIZATION_CHANGED");
const result = await runOwnAgent({
  baseUrl: process.env.PROOFBILL_URL ?? "https://proofbill-two.vercel.app",
  contractId: "proofbill-endpx-2026.testnet",
  agentId: OWN_AGENT_ID,
  signer: KeyPairSigner.fromSecretKey(OWN_AGENT_KEY as `ed25519:${string}`),
  provider: rpc,
  tokenId: PURCHASE_PASS_ID,
  ...request,
});
console.log(JSON.stringify(result));
