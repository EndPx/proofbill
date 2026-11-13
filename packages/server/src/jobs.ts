import { randomBytes } from "node:crypto";
import type { PurchasePass, PurchaseOrder } from "@proofbill/shared";
import { artifactContext, db, seal, type JobRow } from "./index.ts";

export class QueueError extends Error {
  constructor(
    code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}

export async function claimNextJob(
  sql: ReturnType<typeof db>,
  contract: string,
) {
  const rows = await sql<
    JobRow[]
  >`update pb_jobs set state='claimed',lease_until=now()+interval '6 minutes',updated_at=now() where job_id=(select job_id from pb_jobs where state='queued' and network='testnet' and contract_id=${contract} order by created_at for update skip locked limit 1) returning *`;
  return rows[0];
}

type QueueRuntime = {
  sql: ReturnType<typeof db>;
  contract: string;
  agent: string;
  readPass(token: string): Promise<PurchasePass | null>;
  readOrder(order: string): Promise<PurchaseOrder | null>;
};

export async function queuePurchase(
  buyer: string,
  token: string,
  brief: string,
  runtime: QueueRuntime,
): Promise<JobRow> {
  if (brief.trim().length < 8 || brief.length > 8000)
    throw new QueueError("INVALID_PRIVATE_BRIEF", 400);
  const { sql, contract, agent } = runtime;
  return sql.begin(async (tx) => {
    const id = `${token}-order`;
    const existing = await tx.unsafe<JobRow[]>(
      "select * from pb_jobs where network='testnet' and contract_id=$1 and order_id=$2 for update",
      [contract, id],
    );
    const pass = await runtime.readPass(token);
    if (!pass || pass.owner_id !== buyer)
      throw new QueueError("HOLDER_ONLY", 403);
    if (
      pass.phase !== "Available" ||
      pass.transfer_pending ||
      pass.order_id ||
      BigInt(pass.expires_at_ns) <= BigInt(Date.now()) * 1000000n
    )
      throw new QueueError("PASS_NOT_AVAILABLE", 409);
    if (!agent || pass.agent_id !== agent)
      throw new QueueError("ASSIGN_AGENT_FIRST", 409);
    if (await runtime.readOrder(id))
      throw new QueueError("PASS_NOT_AVAILABLE", 409);
    const recent = await tx.unsafe(
      "select count(*)::int as count from pb_jobs where buyer_id=$1 and created_at>now()-interval '24 hours'",
      [buyer],
    );
    if (recent[0].count >= 10) throw new QueueError("DAILY_SERVICE_LIMIT", 429);
    const cipher = seal(
      {
        input: brief.trim(),
        salt: randomBytes(32).toString("hex"),
        nonce: randomBytes(16).toString("hex"),
      },
      artifactContext(id, buyer, contract),
    );
    await tx.unsafe(
      "insert into pb_accounts(account_id) values($1) on conflict(account_id) do nothing",
      [buyer],
    );
    const old = existing[0];
    if (old) {
      if (pass.authorization_revision <= old.revision)
        throw new QueueError("ORDER_ALREADY_QUEUED", 409);
      // Never reset a claimed job or any intent that may have reached an external side effect.
      if (
        !["queued", "failed"].includes(old.state) ||
        old.lease_until !== null ||
        old.request_commitment !== null ||
        old.provider_attempted_at !== null ||
        old.result_cipher !== null ||
        old.erased_at !== null ||
        old.terminal_at !== null
      )
        throw new QueueError("PASS_JOB_REQUIRES_RECONCILIATION", 409);
      const rows = await tx.unsafe<JobRow[]>(
        "update pb_jobs set buyer_id=$1,revision=$2,input_cipher=$3,state='queued',error_code=null,created_at=now(),updated_at=now() where job_id=$4 returning *",
        [buyer, pass.authorization_revision, cipher, old.job_id],
      );
      return rows[0];
    }
    const rows = await tx.unsafe<JobRow[]>(
      "insert into pb_jobs(contract_id,order_id,token_id,buyer_id,revision,input_cipher) values($1,$2,$3,$4,$5,$6) on conflict(network,contract_id,order_id) do nothing returning *",
      [contract, id, token, buyer, pass.authorization_revision, cipher],
    );
    if (!rows[0]) throw new QueueError("ORDER_ALREADY_QUEUED", 409);
    return rows[0];
  });
}
