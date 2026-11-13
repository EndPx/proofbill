// Explicit testnet integration run using project-owned demo accounts; no credentials in output.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { Account, KeyPairSigner, actions } from "near-api-js";
import { provider, contractId, view, call } from "@proofbill/server/chain";
import { db } from "@proofbill/server";
import {
  SERVICE_ID,
  SERVICE_PRICE,
  STORAGE_BUDGET,
  type PurchasePass,
  type PurchaseOrder,
} from "@proofbill/shared";
const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3046",
  root = "proofbill-endpx-2026.testnet";
assert.equal(
  contractId(),
  root,
  "This script only targets the declared demo contract",
);
const transferMode = process.env.E2E_TRANSFER_MODE ?? "unused";
assert.ok(
  ["none", "unused"].includes(transferMode),
  "E2E_TRANSFER_MODE must be none or unused",
);
const steps: unknown[] = [];
async function identity(name: string) {
  const id = `${name}.${root}`,
    c = JSON.parse(
      await readFile(
        join(homedir(), ".near-credentials", "testnet", id + ".json"),
        "utf8",
      ),
    );
  const signer = KeyPairSigner.fromSecretKey(c.private_key ?? c.secret_key);
  return { id, signer, account: new Account(id, provider(), signer) };
}
const alice = await identity("alice"),
  bob = await identity("bob");
async function tx(
  who: typeof alice,
  method: string,
  args: Record<string, unknown>,
  deposit = 1n,
  expectedFailure?: string,
) {
  const out = await who.account.signAndSendTransaction({
    receiverId: root,
    actions: [actions.functionCall(method, args, 150000000000000n, deposit)],
    waitUntil: "FINAL",
    throwOnFailure: !expectedFailure,
    retries: 0,
  });
  const encoded = JSON.stringify(out.status);
  if (expectedFailure) assert.ok(encoded.includes(expectedFailure), encoded);
  steps.push({
    method,
    signer: who.id,
    tx_hash: out.transaction.hash,
    expected_failure: expectedFailure ?? null,
    status: out.status,
  });
  console.log(
    JSON.stringify({
      method,
      tx_hash: out.transaction.hash,
      expected_failure: expectedFailure ?? null,
    }),
  );
  return out;
}
async function post(path: string, body: unknown, cookie = "") {
  return fetch(base + "/api/" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function login(who: typeof alice) {
  const c = await (await post("auth/challenge", { accountId: who.id })).json();
  assert.ok(c.id, "Challenge was not created");
  const signed = await who.signer.signNep413Message(who.id, {
    message: c.message,
    recipient: c.recipient,
    nonce: Buffer.from(c.nonce, "base64"),
  });
  const r = await post("auth/verify", {
    id: c.id,
    accountId: who.id,
    publicKey: signed.publicKey.toString(),
    signature: Buffer.from(signed.signature).toString("base64"),
  });
  assert.equal(r.status, 200, await r.text());
  const cookie = r.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  steps.push({ check: "wallet_message_login", account: who.id, passed: true });
  return cookie;
}
await mkdir("docs/evidence/integration", { recursive: true });
let token = process.env.E2E_TOKEN_ID ?? "";
if (!token) {
  const initialHolder = transferMode === "none" ? bob : alice;
  const mint = await tx(
    initialHolder,
    "create_purchase_pass",
    {
      service_id: SERVICE_ID,
      expires_at_ns: ((BigInt(Date.now()) + 86400000n) * 1000000n).toString(),
    },
    BigInt(SERVICE_PRICE) + BigInt(STORAGE_BUDGET),
  );
  const value = (mint.status as { SuccessValue?: string }).SuccessValue;
  assert.ok(value);
  token = (JSON.parse(Buffer.from(value, "base64").toString()) as PurchasePass)
    .token_id;
  await tx(initialHolder, "assign_agent", {
    token_id: token,
    expected_revision: 0,
    agent_id: process.env.NEAR_AGENT_ID,
  });
  if (transferMode === "unused") {
    await tx(alice, "nft_transfer", {
      token_id: token,
      receiver_id: bob.id,
      approval_id: null,
      memo: "Integration: unused entitlement follows the NFT",
    });
    const transferred = await view<PurchasePass>("get_pass", {
      token_id: token,
    });
    assert.equal(transferred.owner_id, bob.id);
    assert.equal(transferred.agent_id, null);
    assert.equal(transferred.authorization_revision, 2);
    await tx(
      alice,
      "cancel_and_refund",
      { token_id: token, expected_revision: 2 },
      1n,
      "HOLDER_ONLY",
    );
    await tx(bob, "assign_agent", {
      token_id: token,
      expected_revision: 2,
      agent_id: process.env.NEAR_AGENT_ID,
    });
  }
} else {
  const resumed = await view<PurchasePass>("get_pass", { token_id: token });
  assert.equal(resumed.owner_id, bob.id);
  assert.equal(resumed.phase, "Available");
  assert.equal(resumed.agent_id, process.env.NEAR_AGENT_ID);
  steps.push({
    check: "resumed_existing_funded_pass",
    token_id: token,
    current_owner: bob.id,
    revision: resumed.authorization_revision,
  });
}
const bobCookie = await login(bob),
  aliceCookie = await login(alice);
const queued = await post(
  "jobs",
  {
    tokenId: token,
    input:
      "We need 12 workshop notebooks for our community session. Requested by the Community team.",
  },
  bobCookie,
);
assert.equal(queued.status, 201, await queued.text());
const id = `${token}-order`;
console.log(
  JSON.stringify({ order_id: id, state: "waiting_for_real_inference" }),
);
let order: PurchaseOrder | null = null;
for (let i = 0; i < 130; i++) {
  order = await view<PurchaseOrder | null>("get_order", { order_id: id });
  if (order?.phase === "Delivered") break;
  const jobs =
    await db()`select state,error_code from pb_jobs where contract_id=${root} and order_id=${id}`;
  if (jobs[0]?.state === "failed")
    throw new Error(`Worker stopped: ${jobs[0].error_code}`);
  await new Promise((r) => setTimeout(r, 2500));
}
assert.equal(order?.phase, "Delivered", "No verified delivery was confirmed");
const denied = await fetch(base + "/api/private/" + id, {
  headers: { Cookie: aliceCookie },
});
assert.equal(denied.status, 404);
const privateResponse = await fetch(base + "/api/private/" + id, {
  headers: { Cookie: bobCookie },
});
assert.equal(privateResponse.status, 200);
const result = await privateResponse.json();
assert.equal(Number(result.result.output.quantity), 12);
assert.ok(
  result.result.checks
    .filter((c: { state: string }) => c.state !== "not_checked")
    .every((c: { state: string }) => c.state === "passed"),
);
steps.push({
  check: "private_buyer_read",
  allowed: bob.id,
  denied: alice.id,
  passed: true,
  synthetic_output: result.result.output,
  evidence_checks: result.result.checks,
});
const paid = await tx(bob, "approve_and_pay", {
  order_id: id,
  expected_delivery_commitment: order!.evidence_commitment,
});
await post("observe", { hash: paid.transaction.hash }, bobCookie);
const complete = await view<PurchaseOrder>("get_order", { order_id: id });
const completedPass = await view<PurchasePass>("get_pass", { token_id: token });
assert.equal(complete.phase, "Paid");
assert.equal(completedPass.phase, "Completed");
await tx(
  bob,
  "approve_and_pay",
  { order_id: id, expected_delivery_commitment: order!.evidence_commitment },
  1n,
  "ORDER_NOT_PAYABLE",
);
const ownerTokens = await view<
  { token_id: string; metadata: { extra: string } }[]
>("nft_tokens_for_owner", { account_id: bob.id, from_index: "0", limit: 100 });
assert.equal(
  JSON.parse(ownerTokens.find((t) => t.token_id === token)!.metadata.extra)
    .phase,
  "Completed",
);
const report = {
  tested_at: new Date().toISOString(),
  transfer_mode: transferMode,
  network: "testnet",
  contract_id: root,
  token_id: token,
  order_id: id,
  passed: true,
  steps,
  limits: [
    "Scripted project-owned testnet accounts; not organic users.",
    "Wallet signature protocol verified through HTTP/API; browser wallet confirmation still needs its own smoke check.",
    "Hardware inference proof scope is the application's declared policy, not a production audit.",
  ],
};
await writeFile(
  `docs/evidence/integration/${id}.json`,
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    passed: true,
    order_id: id,
    token_id: token,
    payment_tx: paid.transaction.hash,
  }),
);
await db().end();
