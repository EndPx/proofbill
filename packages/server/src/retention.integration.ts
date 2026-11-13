// Real PostgreSQL scheduling/erasure; chain reads are deterministic fixtures, with no live payloads.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import postgres from "postgres";
import { runRetention } from "../../../workers/agent/src/retention.ts";
import type { WorkerRuntime } from "../../../workers/agent/src/runner.ts";

const url = process.env.QUEUE_TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/proofbill_queue_check")
  throw new Error("ISOLATED_TEST_DATABASE_REQUIRED");
const schema = `retention_${randomBytes(8).toString("hex")}`;
const admin = postgres(url, { max: 1, onnotice: () => {} });
const sql = postgres(url, { max: 3, connection: { search_path: schema }, onnotice: () => {} });
const contract = "retention-check.testnet";
before(async () => {
  await admin.unsafe(`create schema ${schema}`);
  await sql.unsafe(await readFile(new URL("schema.sql", import.meta.url), "utf8"));
  await sql.begin(async tx => {
    await tx.unsafe("select set_config('proofbill.contract_id',$1,true)", [contract]);
    await tx.unsafe(await readFile(new URL("relations.sql", import.meta.url), "utf8"));
  });
  await sql`insert into pb_accounts(account_id) values('buyer.testnet')`;
});
beforeEach(async () => { await sql`delete from pb_jobs`; });
after(async () => {
  await sql.end();
  await admin.unsafe(`drop schema ${schema} cascade`);
  await admin.end();
});
async function job(id: string, age = 10, scope = contract) {
  const [created] = await sql`insert into pb_jobs(contract_id,order_id,token_id,buyer_id,revision,state,input_cipher,result_cipher,created_at)
    values(${scope},${id},${id},'buyer.testnet',1,'delivered','synthetic-input','synthetic-result',now()-${age}*interval '1 day') returning job_id`;
  return created.job_id as string;
}
function runtime(read: (method: string, args: Record<string, unknown>) => Promise<unknown>) {
  return {sql,contract,view:read as WorkerRuntime["view"]};
}
test("completed jobs behind twenty unresolved records get a turn across fresh worker runtimes", async () => {
  for (let i = 0; i < 20; i++) await job(`unresolved-${i}`);
  const paid = await job("paid-job", 9);
  const checked: string[] = [];
  const read = async (_method: string, args: Record<string, unknown>) => {
    checked.push(String(args.order_id));
    return {phase:args.order_id === "paid-job" ? "Paid" : "Delivered"};
  };
  await runRetention(runtime(read));
  assert.equal(checked.length,20);
  assert.equal(checked.includes("paid-job"),false);
  await runRetention(runtime(read));
  assert.equal(checked.includes("paid-job"),true);
  const [record] = await sql`select terminal_at,retention_checked_at,input_cipher from pb_jobs where job_id=${paid}`;
  assert.ok(record.terminal_at);
  assert.ok(record.retention_checked_at);
  assert.equal(record.input_cipher,"synthetic-input");
});
test("RPC failure is rotated and does not block terminal observation or due erasure", async () => {
  await job("failing-rpc",12);
  const done = await job("paid-job",11);
  const due = await job("due-job");
  await sql`update pb_jobs set terminal_at=now()-interval '8 days' where job_id=${due}`;
  await runRetention(runtime(async (_method,args) => {
    if (args.order_id === "failing-rpc") throw new Error("RPC_UNAVAILABLE");
    return {phase:"Paid"};
  }));
  const rows = await sql`select order_id,terminal_at,retention_checked_at,state,input_cipher,result_cipher,erased_at from pb_jobs`;
  assert.ok(rows.find(r=>r.order_id==="failing-rpc")!.retention_checked_at);
  assert.ok(rows.find(r=>r.order_id==="paid-job")!.terminal_at);
  const erased = rows.find(r=>r.order_id==="due-job")!;
  assert.equal(erased.state,"erased");
  assert.equal(erased.input_cipher,null);
  assert.equal(erased.result_cipher,null);
  assert.ok(erased.erased_at);
  assert.ok(done);
});
test("erasure respects seven days and contract scope, and unreserved refunded passes become terminal", async () => {
  const fresh=await job("fresh-terminal"),other=await job("other-contract",10,"other.testnet");
  await job("unreserved");
  await sql`update pb_jobs set terminal_at=now()-interval '6 days' where job_id=${fresh}`;
  await sql`update pb_jobs set terminal_at=now()-interval '8 days' where job_id=${other}`;
  await runRetention(runtime(async (method) => method==="get_order" ? null : {phase:"Refunded"}));
  const rows=await sql`select order_id,input_cipher,terminal_at,erased_at from pb_jobs`;
  assert.equal(rows.find(r=>r.order_id==="fresh-terminal")!.input_cipher,"synthetic-input");
  assert.equal(rows.find(r=>r.order_id==="other-contract")!.input_cipher,"synthetic-input");
  assert.ok(rows.find(r=>r.order_id==="unreserved")!.terminal_at);
  assert.ok(rows.every(r=>r.erased_at===null));
});
