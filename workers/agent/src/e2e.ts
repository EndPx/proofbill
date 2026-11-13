// Explicit testnet integration run using project-owned demo accounts; no credentials in output.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { Account, KeyPairSigner, actions } from "near-api-js";
import { provider, contractId, view, call } from "@proofbill/server/chain";
import { db } from "@proofbill/server";
import { runOwnAgent, makeAgentBrief } from "@proofbill/agent-client";
import {
  SERVICE_ID,
  SERVICE_PRICE,
  STORAGE_BUDGET,
  budgetFunding,
  nextOrderId,
  parseNearAmount,
  parseOrderPriceLimit,
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
assert.equal(await provider().getNetworkId(),"testnet");
const transferMode = process.env.E2E_TRANSFER_MODE ?? "unused";
assert.ok(
  ["none", "unused"].includes(transferMode),
  "E2E_TRANSFER_MODE must be none or unused",
);
const agentKind = process.env.E2E_AGENT_KIND ?? "proofbill";
const paymentMode = process.env.E2E_PAYMENT_MODE ?? "Manual";
assert.ok(["proofbill", "external"].includes(agentKind));
assert.ok(["Manual", "Automatic"].includes(paymentMode));
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
const alice = await identity(process.env.E2E_SWAP_ACCOUNTS === "yes" ? "bob" : "alice"),
  bob = await identity(process.env.E2E_SWAP_ACCOUNTS === "yes" ? "alice" : "bob");
const assignedAgent =
  agentKind === "external" ? alice.id : process.env.NEAR_AGENT_ID;
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
const budgetOrders = Number(process.env.E2E_BUDGET_ORDERS ?? "0");
assert.ok(Number.isInteger(budgetOrders) && budgetOrders >= 0 && budgetOrders <= 100);
const budgetAmount = (BigInt(SERVICE_PRICE) * BigInt(budgetOrders)).toString();
const flexibleBudget = process.env.E2E_FLEXIBLE_BUDGET ? parseNearAmount(process.env.E2E_FLEXIBLE_BUDGET) : null;
const priceLimit = process.env.E2E_MAX_ORDER_PRICE ? parseOrderPriceLimit(process.env.E2E_MAX_ORDER_PRICE) : null;
assert.ok(!flexibleBudget||budgetOrders===0,"Choose either flexible total or legacy order count");
assert.ok(token||!priceLimit||flexibleBudget,"A new order ceiling requires flexible-budget creation");
if(flexibleBudget)assert.equal((await(await fetch(base+"/api/config")).json()).flexibleBudgets,true,"Hosted flexible-budget capability is not active");
if (!token) {
  const initialHolder = transferMode === "none" ? bob : alice;
  const mint = await tx(
    initialHolder,
    flexibleBudget ? "create_flexible_budget_pass" : budgetOrders ? "create_budget_pass" : "create_purchase_pass",
    {
      service_id: SERVICE_ID,
      payment_mode: paymentMode,
      ...(budgetOrders ? {budget_yocto:budgetAmount} : {}),
      ...(flexibleBudget?{budget_yocto:flexibleBudget,max_order_price_yocto:priceLimit}:{}),
      expires_at_ns: ((BigInt(Date.now()) + 86400000n) * 1000000n).toString(),
    },
    flexibleBudget?BigInt(budgetFunding(flexibleBudget,{flexible:true}).total):budgetOrders ? BigInt(budgetFunding(budgetAmount).total) : BigInt(SERVICE_PRICE) + BigInt(STORAGE_BUDGET),
  );
  const value = (mint.status as { SuccessValue?: string }).SuccessValue;
  assert.ok(value);
  token = (JSON.parse(Buffer.from(value, "base64").toString()) as PurchasePass)
    .token_id;
  await tx(initialHolder, "assign_agent", {
    token_id: token,
    expected_revision: 0,
    agent_id:
      transferMode === "none" ? assignedAgent : process.env.NEAR_AGENT_ID,
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
      agent_id: assignedAgent,
      payment_mode: paymentMode,
    });
  }
} else {
  const resumed = await view<PurchasePass>("get_pass", { token_id: token });
  assert.equal(resumed.owner_id, bob.id);
  assert.ok(["Available", "InUse"].includes(resumed.phase));
  assert.equal(resumed.agent_id, assignedAgent);
  assert.equal(resumed.payment_mode ?? "Manual", paymentMode);
  if(process.env.E2E_MAX_ORDER_PRICE)assert.equal(resumed.max_order_price_yocto,priceLimit);
  steps.push({
    check: "resumed_existing_funded_pass",
    token_id: token,
    current_owner: bob.id,
    revision: resumed.authorization_revision,
  });
}
const bobCookie = await login(bob),
  aliceCookie = await login(alice);
let orderPass = await view<PurchasePass>("get_pass", {token_id:token});
if (process.env.E2E_TOKEN_ID && orderPass.budget)
  assert.ok(process.env.E2E_ORDER_ID, "Supply E2E_ORDER_ID explicitly when resuming a budget pass; never infer a new purchase from a rerun");
const id = process.env.E2E_ORDER_ID ?? orderPass.order_id ?? nextOrderId(orderPass);
const existingOrder = await view<PurchaseOrder | null>("get_order", {
  order_id: id,
});
if(!existingOrder && BigInt(orderPass.storage_required_for_order_yocto??"0")>0n){
  assert.equal(process.env.E2E_STORAGE_TOP_UP,"yes","Explicitly allow a separate storage deposit before the next order");
  await tx(bob,"top_up_storage",{token_id:token},BigInt(orderPass.storage_required_for_order_yocto!));
  orderPass=await view<PurchasePass>("get_pass",{token_id:token});
}
if (!existingOrder && agentKind === "proofbill") {
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
} else if (agentKind === "external") {
  await mkdir(".local/feature-check", { recursive: true });
  const requestFile = `.local/feature-check/${id}-request.json`;
  let brief: ReturnType<typeof makeAgentBrief>;
  try {
    brief = JSON.parse(await readFile(requestFile, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    brief = makeAgentBrief(
      "We need 12 workshop notebooks for our community session. Requested by the Community team.",
    );
    await writeFile(requestFile, JSON.stringify(brief), { mode: 0o600 });
  }
  const agentPass = await view<PurchasePass>("get_pass", { token_id: token });
  const external = await runOwnAgent({
    baseUrl: base,
    contractId: root,
    agentId: alice.id,
    signer: alice.signer,
    provider: provider(),
    tokenId: token,
    orderId: id,
    buyerId: bob.id,
    revision: agentPass.authorization_revision,
    brief,
  });
  steps.push({
    check: "external_agent_reserved_and_submitted",
    agent_id: alice.id,
    ...external,
    passed: true,
  });
  // Replaying the same signed agent submission must reuse the order, never run a second inference.
  const repeated = await runOwnAgent({
    baseUrl: base,
    contractId: root,
    agentId: alice.id,
    signer: alice.signer,
    provider: provider(),
    tokenId: token,
    orderId: id,
    buyerId: bob.id,
    revision: agentPass.authorization_revision,
    brief,
  }).catch(async (error) => {
    const confirmed = await view<PurchaseOrder>("get_order",{order_id:id});
    if (orderPass.budget && confirmed.phase === "Paid" && error.message === "PASS_AUTHORIZATION_CHANGED")
      return {orderId:id,reservationTx:null};
    throw error;
  });
  assert.equal(repeated.orderId, id);
  assert.equal(repeated.reservationTx, null);
}
const livePass = await view<PurchasePass>("get_pass", { token_id: token });
assert.equal(livePass.owner_id, bob.id);
assert.equal(livePass.payment_mode ?? "Manual", paymentMode);
// The assigned agent cannot change owner-only payment authorization or approve a manual order.
await tx(
  alice,
  "assign_agent",
  {
    token_id: token,
    expected_revision: livePass.authorization_revision,
    agent_id: alice.id,
    payment_mode: "Automatic",
  },
  1n,
  "HOLDER_ONLY",
);
console.log(
  JSON.stringify({ order_id: id, state: "waiting_for_real_inference" }),
);
let order: PurchaseOrder | null = null;
for (let i = 0; i < 130; i++) {
  order = await view<PurchaseOrder | null>("get_order", { order_id: id });
  if (
    paymentMode === "Automatic"
      ? order?.phase === "Paid"
      : order?.phase === "Delivered"
  )
    break;
  const jobs =
    await db()`select state,error_code from pb_jobs where contract_id=${root} and order_id=${id}`;
  if (jobs[0]?.state === "failed")
    throw new Error(`Worker stopped: ${jobs[0].error_code}`);
  await new Promise((r) => setTimeout(r, 2500));
}
assert.equal(
  order?.phase,
  paymentMode === "Automatic" ? "Paid" : "Delivered",
  "No verified delivery/settlement was confirmed",
);
let deliveredJob = false;
for (let i = 0; i < 20; i++) {
  const jobs =
    await db()`select state,error_code from pb_jobs where contract_id=${root} and order_id=${id}`;
  if (jobs[0]?.state === "failed")
    throw new Error(`Worker stopped: ${jobs[0].error_code}`);
  if (jobs[0]?.state === "delivered") {
    deliveredJob = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 500));
}
assert.ok(deliveredJob, "Worker delivery acknowledgement not confirmed");
const denied = await fetch(base + "/api/private/" + id, {
  headers: { Cookie: aliceCookie },
});
assert.equal(denied.status, 404);
const privateResponse = await fetch(base + "/api/private/" + id, {
  headers: { Cookie: bobCookie },
});
assert.equal(privateResponse.status, 200);
const result = await privateResponse.json();
const exported = await fetch(base + "/api/private/" + id + "?export=1", {
  headers: { Cookie: bobCookie },
});
assert.equal(exported.status, 200);
await mkdir(".local/feature-check", { recursive: true });
await writeFile(`.local/feature-check/${id}-evidence.json`, await exported.text(), { mode: 0o600 });
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
let paymentTx: string;
if (paymentMode === "Manual") {
  await tx(
    alice,
    "approve_and_pay",
    { order_id: id, expected_delivery_commitment: order!.evidence_commitment },
    1n,
    "HOLDER_ONLY",
  );
  const paid = await tx(bob, "approve_and_pay", {
    order_id: id,
    expected_delivery_commitment: order!.evidence_commitment,
  });
  paymentTx = paid.transaction.hash;
  await post("observe", { hash: paymentTx }, bobCookie);
} else {
  const refs =
    await db()`select tx_hash from pb_chain_observations where contract_id=${root} and order_id=${id} and action='publish_delivery' order by id desc limit 1`;
  assert.ok(refs[0]?.tx_hash);
  paymentTx = refs[0].tx_hash;
  steps.push({
    check: "automatic_payment_without_owner_approval",
    delivery_and_payment_tx: paymentTx,
    passed: true,
  });
}
const complete = await view<PurchaseOrder>("get_order", { order_id: id });
const completedPass = await view<PurchasePass>("get_pass", { token_id: token });
assert.equal(complete.phase, "Paid");
const expectedPassPhase = completedPass.budget && BigInt(completedPass.budget.available_yocto)>0n ? "Available" : "Completed";
assert.equal(completedPass.phase, expectedPassPhase);
assert.equal(completedPass.owner_id, bob.id);
assert.equal(complete.agent_id, assignedAgent);
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
  expectedPassPhase,
);
const report = {
  tested_at: new Date().toISOString(),
  transfer_mode: transferMode,
  agent_kind: agentKind,
  payment_mode: paymentMode,
  app_origin: new URL(base).origin,
  network: "testnet",
  contract_id: root,
  token_id: token,
  order_id: id,
  pass_phase: completedPass.phase,
  service_budget: completedPass.budget ?? null,
  recorded_order_ceiling_yocto: complete.max_order_price_yocto??null,
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
    payment_tx: paymentTx,
  }),
);
await db().end();
