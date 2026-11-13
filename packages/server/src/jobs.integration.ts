// Real PostgreSQL locking; chain reads are controlled fixtures, not testnet evidence.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { test, before, beforeEach, after } from "node:test";
import postgres from "postgres";
import { queuePurchase, claimNextJob } from "./jobs.ts";
import { open, artifactContext } from "./index.ts";
import type { PurchasePass, PurchaseOrder } from "@proofbill/shared";

const url = process.env.QUEUE_TEST_DATABASE_URL;
if (!url) throw new Error("QUEUE_TEST_DATABASE_URL_REQUIRED");
const database = new URL(url);
if (!database.pathname.endsWith("/proofbill_queue_check"))
  throw new Error("ISOLATED_TEST_DATABASE_REQUIRED");
const schema = `queue_${randomBytes(8).toString("hex")}`;
const admin = postgres(url, { max: 1, onnotice: () => {} });
const sql = postgres(url, { max: 5, connection: { search_path: schema } });
const contract = "queue-check.testnet",
  agent = "agent.queue-check.testnet";
process.env.ARTIFACT_ENCRYPTION_KEY = randomBytes(32).toString("hex");
before(async () => {
  await admin.unsafe(`create schema ${schema}`);
  await sql.unsafe(
    await readFile(new URL("schema.sql", import.meta.url), "utf8"),
  );
  await sql.begin(async (tx) => {
    await tx.unsafe("select set_config('proofbill.contract_id',$1,true)", [
      contract,
    ]);
    await tx.unsafe(
      await readFile(new URL("relations.sql", import.meta.url), "utf8"),
    );
  });
});
beforeEach(async () => {
  await sql`delete from pb_jobs`;
});
after(async () => {
  await sql.end();
  await admin.unsafe(`drop schema ${schema} cascade`);
  await admin.end();
});
let n = 0;
function fixture() {
  const token = `check-${++n}`;
  let pass: PurchasePass = {
    token_id: token,
    owner_id: "alice.testnet",
    seller_id: "seller.testnet",
    model_id: "fixture",
    price_yocto: "10000000000000000000000",
    expires_at_ns: ((BigInt(Date.now()) + 86400000n) * 1000000n).toString(),
    authorization_revision: 1,
    agent_id: agent,
    phase: "Available",
    order_id: null,
    storage_credit_yocto: "0",
    transfer_pending: false,
    attempt: 0,
  };
  const runtime = {
    sql,
    contract,
    agent,
    readPass: async () => ({ ...pass }),
    readOrder: async () => null,
  };
  const queue = (
    buyer = pass.owner_id,
    brief = "Order 12 notebooks for Maya.",
  ) => queuePurchase(buyer, token, brief, runtime);
  const handover = () => {
    pass = {
      ...pass,
      owner_id: "bob.testnet",
      authorization_revision: 3,
      agent_id: agent,
    };
  };
  return { token, runtime, queue, handover, pass: () => pass };
}

test("normal owner can queue without transferring NFT; duplicate is rejected", async () => {
  const f = fixture(),
    job = await f.queue();
  assert.equal(job.buyer_id, "alice.testnet");
  assert.equal(job.revision, 1);
  await assert.rejects(f.queue(), /ORDER_ALREADY_QUEUED/);
});

test("queued before transfer: recipient submits fresh encrypted brief", async () => {
  const f = fixture(),
    old = await f.queue();
  f.handover();
  const current = await f.queue("bob.testnet", "Order 7 pens for Bob.");
  assert.equal(current.job_id, old.job_id);
  assert.equal(current.buyer_id, "bob.testnet");
  assert.equal(current.revision, 3);
  assert.equal(current.state, "queued");
  assert.notEqual(current.input_cipher, old.input_cipher);
  assert.equal(
    open<{ input: string }>(
      current.input_cipher!,
      artifactContext(current.order_id, "bob.testnet", contract),
    ).input,
    "Order 7 pens for Bob.",
  );
  assert.throws(() =>
    open(
      current.input_cipher!,
      artifactContext(current.order_id, "alice.testnet", contract),
    ),
  );
  assert.throws(() =>
    open(
      old.input_cipher!,
      artifactContext(current.order_id, "bob.testnet", contract),
    ),
  );
  const stale =
    await sql`select * from pb_jobs where job_id=${old.job_id} and buyer_id='alice.testnet'`;
  assert.equal(stale.length, 0);
  await assert.rejects(f.queue("alice.testnet"), /HOLDER_ONLY/);
});

test("stale authorization failure before reservation can be queued by recipient", async () => {
  const f = fixture(),
    job = await f.queue();
  await sql`update pb_jobs set state='failed',error_code='PASS_AUTHORIZATION_CHANGED' where job_id=${job.job_id}`;
  f.handover();
  const rebound = await f.queue();
  assert.equal(rebound.state, "queued");
  assert.equal(rebound.error_code, null);
});

test("reassignment by the same holder also replaces only an unstarted intent", async () => {
  const f = fixture();
  await f.queue();
  f.pass().authorization_revision = 2;
  const updated = await f.queue();
  assert.equal(updated.buyer_id, "alice.testnet");
  assert.equal(updated.revision, 2);
});

test("all claimed, attempted, terminal and uncertain jobs remain immutable", async () => {
  const cases = [
    { state: "claimed" },
    { state: "reserving" },
    { state: "running" },
    { state: "publishing" },
    { state: "delivered" },
    { state: "reconciliation_required" },
    { state: "failed", request_commitment: "reserved-intent" },
    { state: "failed", provider_attempted_at: new Date() },
    { state: "failed", result_cipher: "private-result" },
    { state: "failed", lease_until: new Date() },
    { state: "failed", terminal_at: new Date() },
    { state: "erased", erased_at: new Date(), input_cipher: null },
  ];
  for (const patch of cases) {
    const f = fixture(),
      old = await f.queue();
    f.handover();
    await sql`update pb_jobs set ${sql(patch)} where job_id=${old.job_id}`;
    await assert.rejects(f.queue(), /PASS_JOB_REQUIRES_RECONCILIATION/);
    const [unchanged] =
      await sql`select * from pb_jobs where job_id=${old.job_id}`;
    assert.equal(unchanged.buyer_id, "alice.testnet");
    assert.equal(unchanged.revision, 1);
    await sql`delete from pb_jobs where job_id=${old.job_id}`;
  }
});

test("new holder must reassign; pending, expired and reserved passes are rejected", async () => {
  const f = fixture();
  await f.queue();
  f.handover();
  f.pass().agent_id = null;
  await assert.rejects(f.queue(), /ASSIGN_AGENT_FIRST/);
  f.pass().agent_id = agent;
  f.pass().transfer_pending = true;
  await assert.rejects(f.queue(), /PASS_NOT_AVAILABLE/);
  f.pass().transfer_pending = false;
  f.pass().expires_at_ns = "1";
  await assert.rejects(f.queue(), /PASS_NOT_AVAILABLE/);
  f.pass().expires_at_ns = (
    (BigInt(Date.now()) + 86400000n) *
    1000000n
  ).toString();
  await assert.rejects(
    queuePurchase("bob.testnet", f.token, "Order 7 pens for Bob.", {
      ...f.runtime,
      readOrder: async () =>
        ({ order_id: `${f.token}-order` }) as PurchaseOrder,
    }),
    /PASS_NOT_AVAILABLE/,
  );
});

test("two recipient requests cannot create or claim duplicate jobs", async () => {
  const f = fixture();
  await f.queue();
  f.handover();
  const results = await Promise.allSettled([f.queue(), f.queue()]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  const claims = await Promise.all([
    claimNextJob(sql, contract),
    claimNextJob(sql, contract),
  ]);
  const claimed = claims.filter(Boolean);
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].buyer_id, "bob.testnet");
  assert.equal(claimed[0].revision, 3);
});

test("worker wins the row lock: recipient cannot replace its claimed snapshot", async () => {
  const f = fixture();
  await f.queue();
  const claimed = await claimNextJob(sql, contract);
  f.handover();
  assert.equal(claimed.buyer_id, "alice.testnet");
  await assert.rejects(f.queue(), /PASS_JOB_REQUIRES_RECONCILIATION/);
  // The existing worker rejects this snapshot before setting a request commitment.
  assert.notEqual(f.pass().authorization_revision, claimed.revision);
  await sql`update pb_jobs set state='failed',error_code='PASS_AUTHORIZATION_CHANGED',lease_until=null where job_id=${claimed.job_id}`;
  const rebound = await f.queue();
  assert.equal(rebound.buyer_id, "bob.testnet");
});

test("recipient holds row lock: SKIP LOCKED worker waits for the new intent", async () => {
  const f = fixture();
  await f.queue();
  f.handover();
  let unlock!: () => void, locked!: () => void;
  const release = new Promise<void>((r) => {
    unlock = r;
  });
  const ready = new Promise<void>((r) => {
    locked = r;
  });
  const pending = queuePurchase(
    "bob.testnet",
    f.token,
    "Order 7 pens for Bob.",
    {
      ...f.runtime,
      readPass: async () => {
        locked();
        await release;
        return { ...f.pass() };
      },
    },
  );
  await ready;
  try {
    assert.equal(await claimNextJob(sql, contract), undefined);
  } finally {
    unlock();
  }
  await pending;
  const claimed = await claimNextJob(sql, contract);
  assert.equal(claimed.buyer_id, "bob.testnet");
  assert.equal(
    open<{ input: string }>(
      claimed.input_cipher!,
      artifactContext(claimed.order_id, "bob.testnet", contract),
    ).input,
    "Order 7 pens for Bob.",
  );
});
