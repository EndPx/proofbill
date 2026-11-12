// Project-owned testnet operational keys only. Full-access keys stay in the local CLI keychain.
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Account, KeyPair, KeyPairSigner, actions } from "near-api-js";
import { provider } from "@proofbill/server/chain";
const root = process.env.NEAR_CONTRACT_ID || "proofbill-endpx-2026.testnet";
if (!root.endsWith(".testnet")) throw new Error("TESTNET_ONLY");
const envPath = new URL("../../../.env.local", import.meta.url);
let text = await readFile(envPath, "utf8");
function set(name: string, value: string) {
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  text = re.test(text)
    ? text.replace(re, line)
    : text.trimEnd() + "\n" + line + "\n";
}
set("NEAR_CONTRACT_ID", root);
set("NEXT_PUBLIC_NEAR_CONTRACT_ID", root);
set("NEAR_RPC_URL", "https://test.rpc.fastnear.com");
for (const [role, methods] of [
  ["agent", ["reserve_order"]],
  ["publisher", ["publish_delivery"]],
] as const) {
  const id = `${role}.${root}`,
    name = `NEAR_${role.toUpperCase()}_KEY`;
  set(`NEAR_${role.toUpperCase()}_ID`, id);
  if (role === "agent") set("NEXT_PUBLIC_NEAR_AGENT_ID", id);
  if (new RegExp(`^${name}=.+$`, "m").test(text)) {
    console.log(`${role} restricted key already configured`);
    continue;
  }
  const credential = JSON.parse(
    await readFile(
      join(homedir(), ".near-credentials", "testnet", id + ".json"),
      "utf8",
    ),
  );
  const account = new Account(
    id,
    provider(),
    KeyPairSigner.fromSecretKey(
      credential.private_key ?? credential.secret_key,
    ),
  );
  const key = KeyPair.fromRandom("ed25519");
  const outcome = await account.signAndSendTransaction({
    receiverId: id,
    actions: [
      actions.addFunctionCallAccessKey(
        key.getPublicKey(),
        root,
        [...methods],
        200000000000000000000000n,
      ),
    ],
    waitUntil: "FINAL",
    throwOnFailure: true,
    retries: 0,
  });
  set(name, key.toString());
  await writeFile(envPath, text, { mode: 0o600 });
  console.log(
    JSON.stringify({
      role,
      account: id,
      permission: "FunctionCall",
      methods,
      tx_hash: outcome.transaction.hash,
    }),
  );
}
await writeFile(envPath, text, { mode: 0o600 });
console.log(
  "Testnet operational configuration saved locally; secret values were not printed.",
);
