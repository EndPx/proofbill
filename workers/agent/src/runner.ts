import {
  artifactContext,
  digest,
  open,
  seal,
  type db,
  type JobRow,
} from "@proofbill/server";
import { claimNextJob } from "@proofbill/server/jobs";
import {
  inferenceRequest,
  MODEL_ID,
  POLICY_ID,
  type PrivateBrief,
  type PurchasePass,
  type PurchaseOrder,
} from "@proofbill/shared";

export type Inference = {
  ok: boolean;
  error_code?: string;
  result?: unknown;
  artifacts?: { response_base64: string; [key: string]: unknown };
  signature_kind?: string;
};
type Saved = Inference & {
  salt: string;
  order_id: string;
  request_commitment: string;
  response_commitment: string;
  evidence_commitment: string;
};
export type WorkerRuntime = {
  sql: ReturnType<typeof db>;
  contract: string;
  agent: string;
  view<T>(method: string, args: Record<string, unknown>): Promise<T>;
  call(
    role: "agent" | "publisher",
    method: string,
    args: Record<string, unknown>,
  ): Promise<unknown>;
  infer(body: Buffer, signal: AbortSignal): Promise<Inference>;
  leaseMs?: number;
  heartbeatMs?: number;
  retryMs?: number;
};
const permanent = new Set([
  "PASS_AUTHORIZATION_CHANGED",
  "ORDER_RESERVATION_MISMATCH",
  "REQUEST_COMMITMENT_MISMATCH",
  "SAVED_ARTIFACT_INVALID",
  "PRIVATE_INPUT_ERASED",
  "PRIVATE_ARTIFACT_INVALID",
  "EXTERNAL_RESERVATION_REQUIRED",
  "PASS_EXPIRED",
  "PRIVATE_RESULT_UNAVAILABLE",
  "ORDER_REFUNDED",
  "PROVIDER_OUTCOME_UNKNOWN",
  "PROVIDER_ATTEMPT_OR_DAILY_LIMIT",
]);
function commitment(kind: string, salt: string, bytes: Uint8Array) {
  return digest(
    Buffer.concat([
      Buffer.from(`proofbill:v1:${kind}:`),
      Buffer.from(salt, "hex"),
      bytes,
    ]),
  );
}
function verifyInference(value: Inference) {
  if (
    !value?.ok ||
    value.signature_kind !== "provider_tee" ||
    !value.artifacts ||
    typeof value.artifacts.response_base64 !== "string" ||
    !value.artifacts.response_base64 ||
    Buffer.from(value.artifacts.response_base64, "base64").toString(
      "base64",
    ) !== value.artifacts.response_base64
  )
    throw new Error("SAVED_ARTIFACT_INVALID");
  return value.artifacts;
}
function decode<T>(cipher: string, context: string): T {
  try {
    return open<T>(cipher, context);
  } catch {
    throw new Error("PRIVATE_ARTIFACT_INVALID");
  }
}
async function updateOwned(
  rt: WorkerRuntime,
  job: JobRow,
  patch: Record<string, string | Date | null>,
) {
  const rows = await rt.sql<
    JobRow[]
  >`update pb_jobs set ${rt.sql(patch)},updated_at=now() where job_id=${job.job_id} and lease_token=${job.lease_token} and lease_until>now() and erased_at is null returning *`;
  if (!rows[0]) throw new Error("WORKER_LEASE_LOST");
  return rows[0];
}
function checkOrder(
  order: PurchaseOrder,
  pass: PurchasePass,
  job: JobRow,
  hash: string,
  agent: string,
) {
  if (
    order.order_id !== job.order_id ||
    order.token_id !== job.token_id ||
    order.buyer_id !== job.buyer_id ||
    order.agent_id !== (job.agent_id ?? agent) ||
    order.revision !== job.revision ||
    order.seller_id !== pass.seller_id ||
    order.price_yocto !== pass.price_yocto ||
    order.request_commitment !== hash
  )
    throw new Error("ORDER_RESERVATION_MISMATCH");
}
async function execute(rt: WorkerRuntime, job: JobRow, signal: AbortSignal) {
  if (!job.input_cipher) throw new Error("PRIVATE_INPUT_ERASED");
  const context = artifactContext(job.order_id, job.buyer_id, job.contract_id);
  const input = decode<PrivateBrief>(job.input_cipher, context);
  if (!/^[a-f0-9]{64}$/.test(input.salt) || !/^[a-f0-9]{32}$/.test(input.nonce))
    throw new Error("PRIVATE_ARTIFACT_INVALID");
  const body = Buffer.from(
    JSON.stringify(
      inferenceRequest(job.order_id, job.token_id, job.revision, input),
    ),
  );
  const requestHash = commitment("request", input.salt, body);
  if (job.request_commitment && job.request_commitment !== requestHash)
    throw new Error("REQUEST_COMMITMENT_MISMATCH");
  const [pass, existing] = await Promise.all([
    rt.view<PurchasePass | null>("get_pass", { token_id: job.token_id }),
    rt.view<PurchaseOrder | null>("get_order", { order_id: job.order_id }),
  ]);
  if (!pass || pass.model_id !== MODEL_ID)
    throw new Error("PASS_AUTHORIZATION_CHANGED");
  let order = existing;
  if (order) checkOrder(order, pass, job, requestHash, rt.agent);
  if (pass.phase === "Refunded" || order?.phase === "Refunded")
    throw new Error("ORDER_REFUNDED");
  let saved: Saved | undefined;
  if (job.result_cipher) {
    saved = decode<Saved>(job.result_cipher, context);
    const artifacts = verifyInference(saved);
    if (
      !job.provider_attempted_at ||
      saved.salt !== input.salt ||
      saved.order_id !== job.order_id ||
      saved.request_commitment !== requestHash ||
      saved.response_commitment !==
        commitment(
          "response",
          input.salt,
          Buffer.from(artifacts.response_base64, "base64"),
        ) ||
      saved.evidence_commitment !==
        commitment(
          "evidence",
          input.salt,
          Buffer.from(JSON.stringify(artifacts)),
        )
    )
      throw new Error("SAVED_ARTIFACT_INVALID");
  }
  // A final delivery belongs to the historical buyer, even if the Completed NFT later moved.
  if (
    order &&
    ["Delivered", "PaymentPending", "Paid", "TransferFailed"].includes(
      order.phase,
    )
  ) {
    if (!saved) throw new Error("PRIVATE_RESULT_UNAVAILABLE");
    if (
      order.response_commitment !== saved.response_commitment ||
      order.evidence_commitment !== saved.evidence_commitment ||
      order.policy_id !== POLICY_ID
    )
      throw new Error("ORDER_RESERVATION_MISMATCH");
    await updateOwned(rt, job, {
      state: "delivered",
      error_code: null,
      lease_token: null,
      lease_until: null,
    });
    return;
  }
  if (
    pass.owner_id !== job.buyer_id ||
    pass.agent_id !== (job.agent_id ?? rt.agent) ||
    pass.authorization_revision !== job.revision ||
    pass.transfer_pending
  )
    throw new Error("PASS_AUTHORIZATION_CHANGED");
  if (BigInt(pass.expires_at_ns) <= BigInt(Date.now()) * 1000000n)
    throw new Error("PASS_EXPIRED");
  if (job.provider_attempted_at && !saved)
    throw new Error("PROVIDER_OUTCOME_UNKNOWN");
  if (signal.aborted) throw new Error("WORKER_LEASE_LOST");
  await updateOwned(rt, job, {
    state: "reserving",
    request_commitment: requestHash,
  });
  if (!order) {
    if (saved || pass.phase !== "Available")
      throw new Error("ORDER_RESERVATION_MISMATCH");
    if (pass.agent_id !== rt.agent)
      throw new Error("EXTERNAL_RESERVATION_REQUIRED");
    if (signal.aborted) throw new Error("WORKER_LEASE_LOST");
    await rt.call("agent", "reserve_order", {
      token_id: job.token_id,
      expected_revision: job.revision,
      request_commitment: requestHash,
    });
    order = await rt.view<PurchaseOrder | null>("get_order", {
      order_id: job.order_id,
    });
  }
  if (!order || order.phase !== "Reserved")
    throw new Error("ORDER_RESERVATION_MISMATCH");
  checkOrder(order, pass, job, requestHash, rt.agent);
  if (!saved) {
    if (signal.aborted) throw new Error("WORKER_LEASE_LOST");
    const attempted = await rt.sql<
      JobRow[]
    >`update pb_jobs set state='running',provider_attempted_at=now(),updated_at=now() where job_id=${job.job_id} and lease_token=${job.lease_token} and lease_until>now() and state='reserving' and erased_at is null and provider_attempted_at is null and (select count(*) from pb_jobs where provider_attempted_at>now()-interval '24 hours')<100 returning *`;
    if (!attempted[0]) throw new Error("PROVIDER_ATTEMPT_OR_DAILY_LIMIT");
    const inferred = await rt.infer(body, signal);
    if (!inferred.ok)
      throw new Error(inferred.error_code ?? "VERIFICATION_UNAVAILABLE");
    const artifacts = verifyInference(inferred);
    saved = {
      ...inferred,
      salt: input.salt,
      order_id: job.order_id,
      request_commitment: requestHash,
      response_commitment: commitment(
        "response",
        input.salt,
        Buffer.from(artifacts.response_base64, "base64"),
      ),
      evidence_commitment: commitment(
        "evidence",
        input.salt,
        Buffer.from(JSON.stringify(artifacts)),
      ),
    };
    await updateOwned(rt, job, {
      state: "publishing",
      result_cipher: seal(saved, context),
    });
  } else {
    await updateOwned(rt, job, { state: "publishing" });
  }
  if (signal.aborted) throw new Error("WORKER_LEASE_LOST");
  await rt.call("publisher", "publish_delivery", {
    order_id: job.order_id,
    request_commitment: requestHash,
    response_commitment: saved.response_commitment,
    evidence_commitment: saved.evidence_commitment,
    model_id: MODEL_ID,
    policy_id: POLICY_ID,
    signature_kind: saved.signature_kind,
  });
  const delivered = await rt.view<PurchaseOrder | null>("get_order", {
    order_id: job.order_id,
  });
  if (
    !delivered ||
    !["Delivered", "PaymentPending", "Paid", "TransferFailed"].includes(
      delivered.phase,
    ) ||
    delivered.request_commitment !== requestHash ||
    delivered.response_commitment !== saved.response_commitment ||
    delivered.evidence_commitment !== saved.evidence_commitment ||
    delivered.policy_id !== POLICY_ID
  )
    throw new Error("DELIVERY_NOT_CONFIRMED");
  checkOrder(delivered, pass, job, requestHash, rt.agent);
  await updateOwned(rt, job, {
    state: "delivered",
    error_code: null,
    lease_token: null,
    lease_until: null,
  });
}

export async function runOnce(rt: WorkerRuntime): Promise<boolean> {
  const leaseMs = rt.leaseMs ?? 360000;
  const job = await claimNextJob(rt.sql, rt.contract, leaseMs);
  if (!job) return false;
  const controller = new AbortController();
  const heartbeat = setInterval(() => {
    void rt.sql`update pb_jobs set lease_until=now()+${leaseMs}*interval '1 millisecond' where job_id=${job.job_id} and lease_token=${job.lease_token} and lease_until>now() and state in ('claimed','reserving','running','publishing')`
      .then((rows) => {
        if (!rows.count) controller.abort();
      })
      .catch(() => controller.abort());
  }, rt.heartbeatMs ?? 20000);
  heartbeat.unref();
  console.log(JSON.stringify({ order_id: job.order_id, state: "started" }));
  try {
    await execute(rt, job, controller.signal);
    console.log(JSON.stringify({ order_id: job.order_id, state: "delivered" }));
  } catch (error) {
    const code =
      error instanceof Error && /^[A-Z_]+$/.test(error.message)
        ? error.message
        : "EXECUTION_UNAVAILABLE";
    const [current] = await rt.sql<
      JobRow[]
    >`select * from pb_jobs where job_id=${job.job_id} and lease_token=${job.lease_token} and lease_until>now() and erased_at is null and state in ('claimed','reserving','running','publishing')`;
    if (current) {
      const unknown =
        current.provider_attempted_at !== null &&
        current.result_cipher === null;
      const retry = !permanent.has(code) && !unknown;
      const state =
        unknown || current.result_cipher || retry
          ? "reconciliation_required"
          : "failed";
      await rt.sql`update pb_jobs set state=${state},error_code=${code},lease_token=null,lease_until=case when ${retry} then now()+${rt.retryMs ?? 30000}*interval '1 millisecond' else null end,updated_at=now() where job_id=${job.job_id} and lease_token=${job.lease_token} and lease_until>now()`;
      console.log(
        JSON.stringify({ order_id: job.order_id, state, error_code: code }),
      );
    }
  } finally {
    clearInterval(heartbeat);
    controller.abort();
  }
  return true;
}
