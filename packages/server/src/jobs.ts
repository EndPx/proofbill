import { randomBytes } from "node:crypto";
import {
  inferenceRequest,
  type PrivateBrief,
  type PurchasePass,
  type PurchaseOrder,
} from "@proofbill/shared";
import { artifactContext, db, digest, seal, type JobRow } from "./index.ts";

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
  leaseMs = 360000,
) {
  const rows = await sql<
    JobRow[]
  >`update pb_jobs set state='claimed',lease_token=gen_random_uuid(),lease_until=now()+${leaseMs}*interval '1 millisecond',updated_at=now() where job_id=(select job_id from pb_jobs where network='testnet' and contract_id=${contract} and erased_at is null and (terminal_at is null or (state='failed' and result_cipher is not null)) and (
      state='queued'
      or (state in ('claimed','reserving','running','publishing') and (lease_until is null or lease_until<=now()))
      or (state='reconciliation_required' and lease_until<=now())
      or (state='failed' and result_cipher is not null)
    ) order by created_at for update skip locked limit 1) returning *`;
  return rows[0];
}

type QueueRuntime = {
  sql: ReturnType<typeof db>;
  contract: string;
  agent: string;
  readPass(token: string): Promise<PurchasePass | null>;
  readOrder(order: string): Promise<PurchaseOrder | null>;
};

export function briefCommitment(
  order: string,
  token: string,
  revision: number,
  brief: PrivateBrief,
) {
  return digest(
    Buffer.concat([
      Buffer.from("proofbill:v1:request:"),
      Buffer.from(brief.salt, "hex"),
      Buffer.from(
        JSON.stringify(inferenceRequest(order, token, revision, brief)),
      ),
    ]),
  );
}

export async function queuePurchase(
  buyer: string,
  token: string,
  input: string,
  runtime: QueueRuntime,
): Promise<JobRow> {
  return preparePurchase(
    buyer,
    token,
    {
      input: input.trim(),
      salt: randomBytes(32).toString("hex"),
      nonce: randomBytes(16).toString("hex"),
    },
    runtime,
  );
}

export async function prepareAgentPurchase(
  agent: string,
  token: string,
  brief: PrivateBrief,
  revision: number,
  runtime: QueueRuntime,
): Promise<JobRow> {
  if (brief.input.length > 8000)
    throw new QueueError("INVALID_PRIVATE_BRIEF", 400);
  if (
    !/^[a-f0-9]{64}$/.test(brief.salt) ||
    !/^[a-f0-9]{32}$/.test(brief.nonce) ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    throw new QueueError("INVALID_AGENT_REQUEST", 400);
  return preparePurchase(
    agent,
    token,
    { ...brief, input: brief.input.trim() },
    runtime,
    revision,
  );
}

async function preparePurchase(
  actor: string,
  token: string,
  brief: PrivateBrief,
  runtime: QueueRuntime,
  externalRevision?: number,
): Promise<JobRow> {
  if (brief.input.length < 8 || brief.input.length > 8000)
    throw new QueueError("INVALID_PRIVATE_BRIEF", 400);
  const { sql, contract, agent } = runtime;
  const external = externalRevision !== undefined;
  return sql.begin(async (tx) => {
    const id = `${token}-order`;
    const [old] = await tx.unsafe<JobRow[]>(
      "select * from pb_jobs where network='testnet' and contract_id=$1 and order_id=$2 for update",
      [contract, id],
    );
    const pass = await runtime.readPass(token);
    if (
      !pass ||
      (external
        ? pass.agent_id !== actor || actor === agent
        : pass.owner_id !== actor)
    )
      throw new QueueError(
        external ? "ASSIGNED_AGENT_ONLY" : "HOLDER_ONLY",
        403,
      );
    if (
      pass.phase !== "Available" ||
      pass.transfer_pending ||
      pass.order_id ||
      BigInt(pass.expires_at_ns) <= BigInt(Date.now()) * 1000000n
    )
      throw new QueueError("PASS_NOT_AVAILABLE", 409);
    if (external && pass.authorization_revision !== externalRevision)
      throw new QueueError("PASS_AUTHORIZATION_CHANGED", 409);
    if (!pass.agent_id || (!external && pass.agent_id !== agent))
      throw new QueueError("ASSIGN_AGENT_FIRST", 409);
    if (await runtime.readOrder(id))
      throw new QueueError("PASS_NOT_AVAILABLE", 409);
    const buyer = pass.owner_id;
    const commitment = external
      ? briefCommitment(id, token, pass.authorization_revision, brief)
      : null;
    if (
      old &&
      external &&
      old.revision === pass.authorization_revision &&
      old.buyer_id === buyer &&
      old.agent_id === actor &&
      old.request_commitment === commitment &&
      old.state === "awaiting_reservation"
    )
      return old;
    if (old) {
      if (pass.authorization_revision <= old.revision)
        throw new QueueError("ORDER_ALREADY_QUEUED", 409);
      // A prepared external reservation cannot succeed after its authorization revision changes.
      const unstarted =
        old.state === "awaiting_reservation" ||
        (["queued", "failed"].includes(old.state) &&
          old.request_commitment === null);
      if (
        !unstarted ||
        old.lease_until !== null ||
        old.provider_attempted_at !== null ||
        old.result_cipher !== null ||
        old.erased_at !== null ||
        old.terminal_at !== null
      )
        throw new QueueError("PASS_JOB_REQUIRES_RECONCILIATION", 409);
    }
    const recent = await tx.unsafe(
      "select count(*)::int as count from pb_jobs where buyer_id=$1 and created_at>now()-interval '24 hours'",
      [buyer],
    );
    if (recent[0].count >= 10) throw new QueueError("DAILY_SERVICE_LIMIT", 429);
    const cipher = seal(brief, artifactContext(id, buyer, contract)),
      state = external ? "awaiting_reservation" : "queued";
    await tx.unsafe(
      "insert into pb_accounts(account_id) values($1) on conflict(account_id) do nothing",
      [buyer],
    );
    const rows = old
      ? await tx.unsafe<JobRow[]>(
          "update pb_jobs set buyer_id=$1,agent_id=$2,revision=$3,input_cipher=$4,request_commitment=$5,state=$6,error_code=null,lease_token=null,created_at=now(),updated_at=now() where job_id=$7 returning *",
          [
            buyer,
            pass.agent_id,
            pass.authorization_revision,
            cipher,
            commitment,
            state,
            old.job_id,
          ],
        )
      : await tx.unsafe<JobRow[]>(
          "insert into pb_jobs(contract_id,order_id,token_id,buyer_id,agent_id,revision,input_cipher,request_commitment,state) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(network,contract_id,order_id) do nothing returning *",
          [
            contract,
            id,
            token,
            buyer,
            pass.agent_id,
            pass.authorization_revision,
            cipher,
            commitment,
            state,
          ],
        );
    if (!rows[0]) throw new QueueError("ORDER_ALREADY_QUEUED", 409);
    return rows[0];
  });
}

export async function submitAgentPurchase(
  actor: string,
  token: string,
  runtime: QueueRuntime,
): Promise<JobRow> {
  const { sql, contract } = runtime;
  return sql.begin(async (tx) => {
    const [job] = await tx.unsafe<JobRow[]>(
      "select * from pb_jobs where network='testnet' and contract_id=$1 and order_id=$2 for update",
      [contract, `${token}-order`],
    );
    if (!job || job.agent_id !== actor || actor === runtime.agent)
      throw new QueueError("ASSIGNED_AGENT_ONLY", 403);
    const [pass, order] = await Promise.all([
      runtime.readPass(token),
      runtime.readOrder(job.order_id),
    ]);
    if (
      !pass ||
      !order ||
      pass.transfer_pending ||
      pass.owner_id !== job.buyer_id ||
      pass.agent_id !== actor ||
      pass.authorization_revision !== job.revision ||
      order.buyer_id !== job.buyer_id ||
      order.agent_id !== actor ||
      order.token_id !== token ||
      order.revision !== job.revision ||
      order.request_commitment !== job.request_commitment ||
      order.seller_id !== pass.seller_id ||
      order.price_yocto !== pass.price_yocto
    )
      throw new QueueError("ORDER_RESERVATION_MISMATCH", 409);
    if (
      !["InUse", "Completed"].includes(pass.phase) ||
      ![
        "Reserved",
        "Delivered",
        "PaymentPending",
        "Paid",
        "TransferFailed",
      ].includes(order.phase)
    )
      throw new QueueError("PASS_NOT_AVAILABLE", 409);
    if (job.state !== "awaiting_reservation") {
      if (
        [
          "queued",
          "claimed",
          "reserving",
          "running",
          "publishing",
          "delivered",
        ].includes(job.state)
      )
        return job;
      throw new QueueError("PASS_JOB_REQUIRES_RECONCILIATION", 409);
    }
    if (
      pass.phase !== "InUse" ||
      order.phase !== "Reserved" ||
      BigInt(pass.expires_at_ns) <= BigInt(Date.now()) * 1000000n
    )
      throw new QueueError("PASS_NOT_AVAILABLE", 409);
    const [queued] = await tx.unsafe<JobRow[]>(
      "update pb_jobs set state='queued',updated_at=now() where job_id=$1 returning *",
      [job.job_id],
    );
    return queued;
  });
}
