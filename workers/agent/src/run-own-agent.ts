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
await mkdir(".local/own-agent", { recursive: true });
const saved = `.local/own-agent/${PURCHASE_PASS_ID}.json`;
let brief: ReturnType<typeof makeAgentBrief>;
try {
  brief = JSON.parse(await readFile(saved, "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  brief = makeAgentBrief(await readFile(PRIVATE_BRIEF_FILE, "utf8"));
  await writeFile(saved, JSON.stringify(brief), { mode: 0o600 });
}
const result = await runOwnAgent({
  baseUrl: process.env.PROOFBILL_URL ?? "https://proofbill-two.vercel.app",
  contractId: "proofbill-endpx-2026.testnet",
  agentId: OWN_AGENT_ID,
  signer: KeyPairSigner.fromSecretKey(OWN_AGENT_KEY as `ed25519:${string}`),
  provider: new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" }),
  tokenId: PURCHASE_PASS_ID,
  brief,
});
console.log(JSON.stringify(result));
