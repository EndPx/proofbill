// Real PostgreSQL + actual killed/restarted Node processes; RPC, payouts and inference are durable fixtures.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { test, before, beforeEach, after } from "node:test";
import postgres from "postgres";
import { MODEL_ID } from "@proofbill/shared";
import { artifactContext, seal, open, type JobRow } from "./index.ts";
import { queuePurchase, claimNextJob } from "./jobs.ts";
import { runOnce } from "../../../workers/agent/src/runner.ts";
import { fixtureRuntime, contract, agent } from "./fixtures/worker-runtime.ts";

const url = process.env.QUEUE_TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/proofbill_queue_check")
  throw new Error("ISOLATED_TEST_DATABASE_REQUIRED");
const schema = `worker_${randomBytes(8).toString("hex")}`;
process.env.ARTIFACT_ENCRYPTION_KEY = randomBytes(32).toString("hex");
const admin = postgres(url, { max: 1, onnotice: () => {} }),
  sql = postgres(url, { max: 5, connection: { search_path: schema } });
before(async () => {
  await admin.unsafe(`create schema ${schema}`);
  await sql.unsafe(
    await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
  await sql.begin(async (tx) => {
    await tx.unsafe("select set_config('proofbill.contract_id',$1,true)", [
      contract,
    ]);
    await tx.unsafe(
      await readFile(new URL("./relations.sql", import.meta.url), "utf8"),
    );
  });
  await sql`create table worker_chain(token_id text primary key,pass_json text not null,order_json text,provider_calls int not null default 0,reservation_calls int not null default 0,publish_calls int not null default 0,payments int not null default 0)`;
});
beforeEach(async () => {
  await sql`delete from pb_jobs`;
  await sql`delete from worker_chain`;
});
after(async () => {
  await sql.end();
  await admin.unsafe(`drop schema ${schema} cascade`);
  await admin.end();
});
async function seed(budget = false) {
  const pass = {
    token_id: "pass-restart",
    owner_id: "buyer.testnet",
    seller_id: "seller.testnet",
    model_id: MODEL_ID,
    price_yocto: "10000000000000000000000",
    expires_at_ns: ((BigInt(Date.now()) + 86400000n) * 1000000n).toString(),
    authorization_revision: 1,
    agent_id: agent,
    payment_mode: "Automatic" as const,
    phase: "Available" as const,
    order_id: null,
    storage_credit_yocto: "20000000000000000000000",
    transfer_pending: false,
    attempt: 0,
    ...(budget ? {budget:{funded_yocto:"30000000000000000000000",available_yocto:"30000000000000000000000",reserved_yocto:"0",spent_yocto:"0",refunded_yocto:"0",orders_created:0}} : {}),
  };
  await sql`insert into worker_chain(token_id,pass_json) values(${pass.token_id},${JSON.stringify(pass)})`;
  return queuePurchase(
    pass.owner_id,
    pass.token_id,
    "Order 12 notebooks for Maya.",
    {
      sql,
      contract,
      agent,
      readPass: async () => pass,
      readOrder: async () => null,
    },
  );
}
function child(crash = "", newOwner = "") {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      fileURLToPath(new URL("./fixtures/restart-worker.ts", import.meta.url)),
    ],
    {
      encoding: "utf8",
      timeout: 20000,
      windowsHide: true,
      env: {
        ...process.env,
        WORKER_FIXTURE_SCHEMA: schema,
        WORKER_FIXTURE_CRASH: crash,
        WORKER_FIXTURE_NEW_OWNER: newOwner,
      },
    },
  );
}
async function expire() {
  await sql`update pb_jobs set lease_until=now()-interval '1 second' where state in ('claimed','reserving','running','publishing','reconciliation_required')`;
}
async function row() {
  return (await sql<JobRow[]>`select * from pb_jobs`)[0];
}
async function chain() {
  return (await sql`select * from worker_chain`)[0];
}

for (const stage of ["claimed", "reserved", "saved", "published"]) {
  test(`SIGKILL at ${stage}: quick restart and later poll finish once`, async () => {
    await seed();
    const killed = child(stage);
    assert.equal(killed.signal, "SIGKILL");
    const early = child();
    assert.equal(early.status, 0, early.stderr);
    assert.ok(early.stdout.includes('"worked":false'));
    await expire();
    const resumed = child();
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.equal((await row()).state, "delivered");
    const c = await chain();
    assert.equal(c.provider_calls, 1);
    assert.equal(c.reservation_calls, 1);
    assert.equal(c.publish_calls, 1);
    assert.equal(c.payments, 1);
    assert.equal(JSON.parse(c.pass_json).owner_id, "buyer.testnet");
    assert.equal(JSON.parse(c.order_json).phase, "Paid");
    const again = child();
    assert.equal(again.status, 0, again.stderr);
    assert.ok(again.stdout.includes('"worked":false'));
  });
}
test("SIGKILL during provider attempt parks unknown outcome instead of inferring twice", async () => {
  await seed();
  assert.equal(child("running").signal, "SIGKILL");
  await expire();
  assert.equal(child().status, 0);
  const j = await row(),
    c = await chain();
  assert.equal(j.state, "reconciliation_required");
  assert.equal(j.error_code, "PROVIDER_OUTCOME_UNKNOWN");
  assert.equal(j.lease_until, null);
  assert.equal(c.provider_calls, 1);
  assert.equal(c.publish_calls, 0);
  assert.equal(c.payments, 0);
  assert.equal(JSON.parse(c.order_json).phase, "Reserved");
  assert.equal(child().status, 0);
  assert.equal((await chain()).provider_calls, 1);
});
test("saved result with a transient publication error retries without a second provider call", async () => {
  await seed();
  assert.equal(child("saved").signal, "SIGKILL");
  await expire();
  const rt = fixtureRuntime(sql),
    call = rt.call;
  let fail = true;
  rt.call = async (...args) => {
    if (args[0] === "publisher" && fail) {
      fail = false;
      throw new Error("RPC_UNAVAILABLE");
    }
    return call(...args);
  };
  await runOnce(rt);
  assert.equal((await row()).state, "reconciliation_required");
  assert.ok((await row()).result_cipher);
  await expire();
  await runOnce(rt);
  assert.equal((await row()).state, "delivered");
  assert.equal((await chain()).provider_calls, 1);
  assert.equal((await chain()).payments, 1);
});
test("authenticated saved artifact mismatch blocks publication", async () => {
  await seed();
  assert.equal(child("saved").signal, "SIGKILL");
  const j = await row();
  const context = artifactContext(j.order_id, j.buyer_id, contract),
    saved = open<Record<string, unknown>>(j.result_cipher!, context);
  saved.evidence_commitment = "f".repeat(64);
  await sql`update pb_jobs set result_cipher=${seal(saved, context)}`;
  await expire();
  assert.equal(child().status, 0);
  const final = await row();
  assert.equal(final.state, "reconciliation_required");
  assert.equal(final.error_code, "SAVED_ARTIFACT_INVALID");
  assert.equal(final.lease_until, null);
  assert.equal((await chain()).publish_calls, 0);
  assert.equal((await chain()).provider_calls, 1);
});
test("lost publication acknowledgement reconciles the historical buyer after terminal NFT transfer", async () => {
  await seed();
  assert.equal(child("published", "recipient.testnet").signal, "SIGKILL");
  await expire();
  assert.equal(child().status, 0);
  const j = await row();
  assert.equal(j.state, "delivered");
  assert.equal(j.buyer_id, "buyer.testnet");
  assert.equal(
    JSON.parse((await chain()).pass_json).owner_id,
    "recipient.testnet",
  );
  assert.throws(() =>
    open(
      j.result_cipher!,
      artifactContext(j.order_id, "recipient.testnet", contract),
    ),
  );
  assert.equal((await chain()).publish_calls, 1);
  assert.equal((await chain()).payments, 1);
});
test("legacy failed publication with intact result is reconciled without new inference", async () => {
  await seed();
  assert.equal(child("saved").signal, "SIGKILL");
  await sql`update pb_jobs set state='failed',lease_until=null,lease_token=null,error_code='EXECUTION_UNAVAILABLE'`;
  assert.equal(child().status, 0);
  assert.equal((await row()).state, "delivered");
  assert.equal((await chain()).provider_calls, 1);
  assert.equal((await chain()).payments, 1);
});
test("heartbeat keeps a live slow inference from being reclaimed", async () => {
  await seed();
  const rt = fixtureRuntime(sql, {
    leaseMs: 1000,
    heartbeatMs: 50,
    delayMs: 1500,
  });
  const processing = runOnce(rt);
  for (let i = 0; i < 30; i++) {
    if ((await chain()).provider_calls) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal(await claimNextJob(sql, contract), undefined);
  await processing;
  assert.equal((await row()).state, "delivered");
  assert.equal((await chain()).provider_calls, 1);
});
test("a stale process cannot persist or publish after another worker owns its lease", async () => {
  await seed();
  let release!: () => void;
  const rt = fixtureRuntime(sql, { heartbeatMs: 10000 }),
    infer = rt.infer;
  rt.infer = async (body, signal) => {
    const result = await infer(body, signal);
    return new Promise((resolve) => {
      release = () => resolve(result);
    });
  };
  const old = runOnce(rt);
  for (let i = 0; i < 100 && !release; i++)
    await new Promise((r) => setTimeout(r, 10));
  assert.ok(release);
  await expire();
  await runOnce(fixtureRuntime(sql));
  release();
  await old;
  assert.equal((await row()).state, "reconciliation_required");
  assert.equal((await row()).error_code, "PROVIDER_OUTCOME_UNKNOWN");
  assert.equal((await row()).result_cipher, null);
  assert.equal((await chain()).provider_calls, 1);
  assert.equal((await chain()).publish_calls, 0);
});

test("a saved publication acknowledgement can be reconciled after a transport error", async () => {
  await seed();
  const rt = fixtureRuntime(sql),
    call = rt.call;
  rt.call = async (...args) => {
    const result = await call(...args);
    if (args[0] === "publisher") throw new Error("RPC_UNAVAILABLE");
    return result;
  };
  await runOnce(rt);
  assert.equal((await row()).state, "reconciliation_required");
  await expire();
  await runOnce(fixtureRuntime(sql));
  assert.equal((await row()).state, "delivered");
  const c = await chain();
  assert.equal(c.provider_calls, 1);
  assert.equal(c.publish_calls, 1);
  assert.equal(c.payments, 1);
});
test("buyer erasure cannot be overwritten by a late inference response", async () => {
  await seed();
  const rt = fixtureRuntime(sql),
    infer = rt.infer;
  rt.infer = async (...args) => {
    const result = await infer(...args);
    await sql`update pb_jobs set state='erased',input_cipher=null,result_cipher=null,erased_at=now()`;
    return result;
  };
  await runOnce(rt);
  const j = await row();
  assert.equal(j.state, "erased");
  assert.equal(j.result_cipher, null);
  assert.equal(j.input_cipher, null);
  assert.equal((await chain()).publish_calls, 0);
  assert.equal((await chain()).provider_calls, 1);
});

test("the same restarted process recovers on a later poll, without another restart", async () => {
  await seed();
  assert.equal(child("claimed").signal, "SIGKILL");
  const processChild = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      fileURLToPath(new URL("./fixtures/restart-worker.ts", import.meta.url)),
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        WORKER_FIXTURE_SCHEMA: schema,
        WORKER_FIXTURE_POLL: "yes",
      },
    },
  );
  let output = "",
    stderr = "";
  processChild.stderr!.on("data", (b) => {
    stderr += b;
  });
  const idle = new Promise<void>((resolve, reject) => {
    processChild.stdout!.on("data", (b) => {
      output += b;
      if (output.includes("fixture-idle")) resolve();
    });
    processChild.on("error", reject);
    processChild.on("close", () => {
      if (!output.includes("fixture-idle"))
        reject(new Error("Worker exited before idle"));
    });
  });
  const closed = new Promise<number | null>((resolve) =>
    processChild.on("close", resolve),
  );
  const timer = setTimeout(() => processChild.kill("SIGKILL"), 10000);
  try {
    await idle;
    await expire();
    assert.equal(await closed, 0, stderr);
  } finally {
    clearTimeout(timer);
    if (processChild.exitCode === null) processChild.kill("SIGKILL");
  }
  assert.equal((await row()).state, "delivered");
  assert.equal((await chain()).provider_calls, 1);
  assert.equal((await chain()).payments, 1);
});
test("legacy failed but already Paid publication is reconciled even after terminal bookkeeping", async () => {
  await seed();
  assert.equal(child("published").signal, "SIGKILL");
  await sql`update pb_jobs set state='failed',lease_until=null,lease_token=null,terminal_at=now(),error_code='EXECUTION_UNAVAILABLE'`;
  assert.equal(child().status, 0);
  assert.equal((await row()).state, "delivered");
  assert.equal((await chain()).publish_calls, 1);
  assert.equal((await chain()).provider_calls, 1);
});
test("saved budget delivery recovers after later ownership change and remaining-balance refund", async () => {
  const job=await seed(true);
  assert.equal(job.order_id,"pass-restart-order-1");
  assert.equal(child("published").signal,"SIGKILL");
  const current=await chain(),pass=JSON.parse(current.pass_json);
  assert.equal(pass.phase,"Available");
  pass.phase="Refunded";pass.owner_id="teammate.testnet";pass.agent_id=null;pass.authorization_revision+=2;
  pass.budget.refunded_yocto=pass.budget.available_yocto;pass.budget.available_yocto="0";
  await sql`update worker_chain set pass_json=${JSON.stringify(pass)}`;
  await sql`update pb_jobs set state='failed',lease_until=null,lease_token=null,terminal_at=now(),error_code='EXECUTION_UNAVAILABLE'`;
  assert.equal(child().status,0);
  assert.equal((await row()).state,"delivered");
  assert.equal((await row()).buyer_id,"buyer.testnet");
  assert.equal((await chain()).provider_calls,1);
  assert.equal((await chain()).publish_calls,1);
  assert.equal((await chain()).payments,1);
});
test("a transient read failure before inference can retry safely", async () => {
  await seed();
  const rt = fixtureRuntime(sql),
    read = rt.view;
  rt.view = async () => {
    throw new Error("RPC_UNAVAILABLE");
  };
  await runOnce(rt);
  assert.equal((await row()).state, "reconciliation_required");
  assert.equal((await chain()).provider_calls, 0);
  await expire();
  rt.view = read;
  await runOnce(rt);
  assert.equal((await row()).state, "delivered");
  assert.equal((await chain()).provider_calls, 1);
  assert.equal((await chain()).payments, 1);
});
