import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatReceiptNear,
  type PurchaseOrder,
  type PurchasePass,
} from "@proofbill/shared";
import { readPublicReceipt } from "./receipts.ts";
function fixture() {
  const order: PurchaseOrder = {
    order_id: "pass-2-order",
    token_id: "pass-2",
    buyer_id: "buyer.testnet",
    agent_id: "agent.testnet",
    seller_id: "seller.testnet",
    price_yocto: "10000000000000000000000",
    revision: 1,
    request_commitment: "a".repeat(64),
    response_commitment: "b".repeat(64),
    evidence_commitment: "c".repeat(64),
    policy_id: "near-tee-ecdsa-v1",
    phase: "Paid",
    attempt: 1,
    created_at_ns: "1794528000000000000",
  };
  const pass: PurchasePass = {
    token_id: "pass-2",
    owner_id: "buyer.testnet",
    agent_id: "agent.testnet",
    seller_id: order.seller_id,
    model_id: "fixture",
    price_yocto: order.price_yocto,
    authorization_revision: 1,
    expires_at_ns: "1999999999000000000",
    phase: "Completed",
    order_id: order.order_id,
    storage_credit_yocto: "0",
    transfer_pending: false,
    attempt: 0,
    payment_mode: "Manual",
  };
  return {
    order,
    pass,
    reader: {
      contract: "proofbill.testnet",
      block: { hash: "1".repeat(32), height: 100 },
      order: async (): Promise<PurchaseOrder | null> => order,
      pass: async () => pass,
      references: async (): Promise<Record<string, unknown>[]> => [],
    },
  };
}
test("a reusable pass preserves historical receipts and their authorization after later purchases and handover", async () => {
  const f=fixture();
  f.order.order_id="pass-2-order-1";
  f.order.payment_mode="Automatic";
  f.pass.budget={funded_yocto:"30000000000000000000000",available_yocto:"10000000000000000000000",reserved_yocto:"0",spent_yocto:"20000000000000000000000",refunded_yocto:"0",orders_created:2};
  f.pass.owner_id="teammate.testnet";
  f.pass.phase="Available";
  f.pass.order_id=null;
  f.pass.payment_mode="Manual";
  const receipt=await readPublicReceipt(f.order.order_id,f.reader);
  assert.equal(receipt?.order_phase,"Paid");
  assert.equal(receipt?.payment_mode,"Automatic");
  assert.equal(receipt?.buyer_id,"buyer.testnet");
  assert.equal(receipt?.current_holder,"teammate.testnet");
  f.pass.phase="Refunded";
  assert.equal((await readPublicReceipt(f.order.order_id,f.reader))?.order_phase,"Paid");
  delete f.order.payment_mode;
  await assert.rejects(readPublicReceipt(f.order.order_id,f.reader),/RECEIPT_UNAVAILABLE/);
});
test("flexible receipts retain their own ceiling and accept sequence numbers beyond one hundred",async()=>{
  const f=fixture();f.order.order_id="pass-2-order-101";f.order.payment_mode="Automatic";
  f.order.max_order_price_yocto="100000000000000000000000";
  f.pass.phase="Available";f.pass.order_id=null;f.pass.max_order_price_yocto=null;
  f.pass.budget={funded_yocto:"2000000000000000000000000",available_yocto:"990000000000000000000000",reserved_yocto:"0",spent_yocto:"1010000000000000000000000",refunded_yocto:"0",orders_created:101};
  const receipt=await readPublicReceipt(f.order.order_id,f.reader);
  assert.equal(receipt?.max_order_price_yocto,f.order.max_order_price_yocto);
  f.order.max_order_price_yocto="5000000000000000000000";
  await assert.rejects(readPublicReceipt(f.order.order_id,f.reader),/RECEIPT_UNAVAILABLE/);
});
test("public receipt projects only allowlisted fields including references", async () => {
  const f = fixture();
  Object.assign(f.order, {
    private_input: "PRIVATE_FIXTURE_SECRET",
    result_cipher: "PRIVATE_FIXTURE_SECRET",
  });
  Object.assign(f.pass, { raw_response: "PRIVATE_FIXTURE_SECRET" });
  f.reader.references = async () => [
    {
      action: "publish_delivery",
      tx_hash: "1".repeat(44),
      signer_id: "publisher.testnet",
      created_at: new Date(0),
      outcome: { secret: "PRIVATE_FIXTURE_SECRET" },
      input_cipher: "PRIVATE_FIXTURE_SECRET",
    },
  ];
  const receipt = await readPublicReceipt("pass-2-order", f.reader);
  assert.equal(receipt?.order_phase, "Paid");
  assert.equal(receipt?.observations.length, 1);
  assert.ok(!JSON.stringify(receipt).includes("PRIVATE_FIXTURE_SECRET"));
  assert.ok(!("job" in receipt!));
  assert.ok(!("result" in receipt!));
});
test("public receipt distinguishes Manual and Automatic authorization", async () => {
  const f = fixture();
  assert.equal(
    (await readPublicReceipt("pass-2-order", f.reader))?.payment_mode,
    "Manual",
  );
  f.pass.payment_mode = "Automatic";
  assert.equal(
    (await readPublicReceipt("pass-2-order", f.reader))?.payment_mode,
    "Automatic",
  );
});
test("historical buyer and current NFT holder remain separate after a completed transfer", async () => {
  const f = fixture();
  f.pass.owner_id = "recipient.testnet";
  f.pass.agent_id = null;
  f.pass.authorization_revision = 2;
  const receipt = await readPublicReceipt("pass-2-order", f.reader);
  assert.equal(receipt?.buyer_id, "buyer.testnet");
  assert.equal(receipt?.current_holder, "recipient.testnet");
});
test("pending and refunded order phases are preserved without a Paid fallback", async () => {
  for (const [phase, passPhase] of [
    ["PaymentPending", "InUse"],
    ["Refunded", "Refunded"],
  ] as const) {
    const f = fixture();
    f.order.phase = phase;
    f.pass.phase = passPhase;
    assert.equal(
      (await readPublicReceipt("pass-2-order", f.reader))?.order_phase,
      phase,
    );
  }
});
test("missing/invalid receipt returns not found without reading unrelated state", async () => {
  const f = fixture();
  let calls = 0;
  f.reader.order = async () => {
    calls++;
    return null;
  };
  assert.equal(await readPublicReceipt("../../private", f.reader), null);
  assert.equal(calls, 0);
  assert.equal(await readPublicReceipt("pass-2-order", f.reader), null);
});
test("mismatched or malformed chain fields cannot become a public payment claim", async () => {
  for (const patch of [
    { token_id: "pass-3" },
    { price_yocto: "-1" },
    { evidence_commitment: "PRIVATE_FIXTURE_SECRET" },
    { phase: "UNKNOWN" },
  ]) {
    const f = fixture();
    Object.assign(f.order, patch);
    await assert.rejects(
      readPublicReceipt("pass-2-order", f.reader),
      /RECEIPT_UNAVAILABLE/,
    );
  }
});
test("missing reference database does not hide confirmed chain state", async () => {
  const f = fixture();
  f.reader.references = async () => {
    throw new Error("PRIVATE_DATABASE_ERROR");
  };
  const receipt = await readPublicReceipt("pass-2-order", f.reader);
  assert.equal(receipt?.order_phase, "Paid");
  assert.equal(receipt?.references_available, false);
  assert.deepEqual(receipt?.observations, []);
});
test("public amount formatting retains yoctoNEAR precision", () => {
  assert.equal(formatReceiptNear("10000000000000000000000"), "0.010");
  assert.equal(formatReceiptNear("1"), "0.000000000000000000000001");
  assert.equal(formatReceiptNear("0"), "0.000");
  assert.throws(() => formatReceiptNear((1n << 128n).toString()));
});
