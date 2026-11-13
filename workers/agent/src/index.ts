import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  db,
  seal,
  open,
  digest,
  artifactContext,
  type JobRow,
} from "@proofbill/server";
import { view, call, contractId } from "@proofbill/server/chain";
import { claimNextJob } from "@proofbill/server/jobs";
import {
  MODEL_ID,
  inferenceRequest,
  type PrivateBrief,
  POLICY_ID,
  type PurchasePass,
  type PurchaseOrder,
} from "@proofbill/shared";
const pythonFile = fileURLToPath(
  new URL("../../inference/inference.py", import.meta.url),
);
type Input = PrivateBrief;
type Inference = {
  ok: boolean;
  error_code?: string;
  result?: unknown;
  artifacts?: { response_base64: string };
  signature_kind?: string;
};
function infer(body: Buffer): Promise<Inference> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    for (const name of [
      "NEAR_AGENT_KEY",
      "NEAR_PUBLISHER_KEY",
      "DATABASE_URL",
      "ARTIFACT_ENCRYPTION_KEY",
    ])
      delete env[name];
    const child = spawn(process.env.PYTHON_BIN ?? "python3", [pythonFile], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "",
      stderr = "";
    let finished = false;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("INFERENCE_EXECUTION_UNKNOWN"));
    }, 300000);
    child.stdout.on("data", (b) => {
      stdout += b.toString();
      if (stdout.length > 8_000_000) {
        child.kill();
        reject(new Error("EVIDENCE_TOO_LARGE"));
      }
    });
    child.stderr.on("data", (b) => {
      stderr = (stderr + b.toString()).slice(-1000);
    });
    child.on("error", () => {
      clearTimeout(timer);
      reject(new Error("INFERENCE_RUNTIME_UNAVAILABLE"));
    });
    child.on("close", () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        resolve(JSON.parse(stdout));
      } catch {
        void stderr;
        reject(new Error("INFERENCE_RUNTIME_UNAVAILABLE"));
      }
    });
    child.stdin.end(
      JSON.stringify({ request_base64: body.toString("base64") }),
    );
  });
}
async function processJob(j: JobRow) {
  if (!j.input_cipher) throw new Error("PRIVATE_INPUT_ERASED");
  const context = artifactContext(j.order_id, j.buyer_id, j.contract_id),
    input = open<Input>(j.input_cipher, context);
  const pass = await view<PurchasePass | null>("get_pass", {
    token_id: j.token_id,
  });
  if (
    !pass ||
    pass.owner_id !== j.buyer_id ||
    pass.authorization_revision !== j.revision ||
    pass.agent_id !== (j.agent_id ?? process.env.NEAR_AGENT_ID)
  )
    throw new Error("PASS_AUTHORIZATION_CHANGED");
  const request = inferenceRequest(j.order_id, j.token_id, j.revision, input);
  const body = Buffer.from(JSON.stringify(request));
  const commitment = (kind: string, bytes: Uint8Array) =>
    digest(
      Buffer.concat([
        Buffer.from(`proofbill:v1:${kind}:`),
        Buffer.from(input.salt, "hex"),
        bytes,
      ]),
    );
  const requestCommitment = commitment("request", body);
  if (j.request_commitment && j.request_commitment !== requestCommitment)
    throw new Error("REQUEST_COMMITMENT_MISMATCH");
  await db()`update pb_jobs set request_commitment=${requestCommitment},state='reserving',updated_at=now() where job_id=${j.job_id}`;
  let order = await view<PurchaseOrder | null>("get_order", {
    order_id: j.order_id,
  });
  if (!order) {
    if (pass.agent_id !== process.env.NEAR_AGENT_ID)
      throw new Error("EXTERNAL_RESERVATION_REQUIRED");
    await call("agent", "reserve_order", {
      token_id: j.token_id,
      expected_revision: j.revision,
      request_commitment: requestCommitment,
    });
    order = await view<PurchaseOrder | null>("get_order", {
      order_id: j.order_id,
    });
  }
  if (
    !order ||
    order.request_commitment !== requestCommitment ||
    order.buyer_id !== j.buyer_id ||
    order.agent_id !== pass.agent_id ||
    order.revision !== j.revision ||
    order.token_id !== j.token_id ||
    order.seller_id !== pass.seller_id ||
    order.price_yocto !== pass.price_yocto ||
    order.phase !== "Reserved"
  )
    throw new Error("ORDER_RESERVATION_MISMATCH");
  const attempt =
    await db()`update pb_jobs set state='running',provider_attempted_at=now(),updated_at=now() where job_id=${j.job_id} and provider_attempted_at is null and (select count(*) from pb_jobs where provider_attempted_at>now()-interval '24 hours')<100 returning order_id`;
  if (!attempt.length) throw new Error("PROVIDER_ATTEMPT_OR_DAILY_LIMIT");
  const inferred = await infer(body);
  if (!inferred.ok || !inferred.artifacts)
    throw new Error(inferred.error_code ?? "VERIFICATION_UNAVAILABLE");
  const responseCommitment = commitment(
      "response",
      Buffer.from(inferred.artifacts.response_base64, "base64"),
    ),
    evidenceCommitment = commitment(
      "evidence",
      Buffer.from(JSON.stringify(inferred.artifacts)),
    );
  const saved = {
    ...inferred,
    salt: input.salt,
    order_id: j.order_id,
    request_commitment: requestCommitment,
    response_commitment: responseCommitment,
    evidence_commitment: evidenceCommitment,
  };
  await db()`update pb_jobs set state='publishing',result_cipher=${seal(saved, context)},updated_at=now() where job_id=${j.job_id}`;
  await call("publisher", "publish_delivery", {
    order_id: j.order_id,
    request_commitment: requestCommitment,
    response_commitment: responseCommitment,
    evidence_commitment: evidenceCommitment,
    model_id: MODEL_ID,
    policy_id: POLICY_ID,
    signature_kind: inferred.signature_kind,
  });
  const delivered = await view<PurchaseOrder>("get_order", {
    order_id: j.order_id,
  });
  if (
    !["Delivered", "Paid", "TransferFailed"].includes(delivered.phase) ||
    delivered.evidence_commitment !== evidenceCommitment
  )
    throw new Error("DELIVERY_NOT_CONFIRMED");
  await db()`update pb_jobs set state='delivered',lease_until=null,updated_at=now() where job_id=${j.job_id}`;
}
async function next() {
  return claimNextJob(db(), contractId());
}
async function retention() {
  const rows = await db()<
    JobRow[]
  >`select * from pb_jobs where contract_id=${contractId()} and terminal_at is null and state in ('awaiting_reservation','delivered','failed','reconciliation_required') limit 20`;
  for (const j of rows) {
    const o = await view<PurchaseOrder | null>("get_order", {
      order_id: j.order_id,
    });
    const p = o
      ? null
      : await view<PurchasePass | null>("get_pass", { token_id: j.token_id });
    if (
      (o && ["Paid", "Refunded"].includes(o.phase)) ||
      p?.phase === "Refunded"
    )
      await db()`update pb_jobs set terminal_at=now() where job_id=${j.job_id} and terminal_at is null`;
  }
  await db()`update pb_jobs set input_cipher=null,result_cipher=null,state='erased',erased_at=now(),updated_at=now() where terminal_at<now()-interval '7 days' and erased_at is null`;
  await db()`delete from pb_challenges where expires_at<now()-interval '1 day'`;
  await db()`delete from pb_sessions where expires_at<now()`;
}
async function main() {
  if (!process.env.NEAR_AGENT_ID || !process.env.NEAR_PUBLISHER_ID)
    throw new Error("WORKER_SIGNERS_NOT_CONFIGURED");
  console.log("ProofBill agent worker ready (testnet)");
  // An interrupted execution is never automatically inferred or paid a second time.
  await db()`update pb_jobs set state='reconciliation_required',error_code='WORKER_INTERRUPTED_CHECK_ORDER',updated_at=now() where state in ('claimed','reserving','running','publishing') and lease_until<now()`;
  let lastRetention = 0;
  for (;;) {
    const j = await next();
    if (j) {
      console.log(JSON.stringify({ order_id: j.order_id, state: "started" }));
      try {
        await processJob(j);
        console.log(
          JSON.stringify({ order_id: j.order_id, state: "delivered" }),
        );
      } catch (e) {
        const error =
          e instanceof Error && /^[A-Z_]+$/.test(e.message)
            ? e.message
            : "EXECUTION_UNAVAILABLE";
        await db()`update pb_jobs set state='failed',error_code=${error},lease_until=null,updated_at=now() where job_id=${j.job_id}`;
        console.log(
          JSON.stringify({
            order_id: j.order_id,
            state: "failed",
            error_code: error,
          }),
        );
      }
    } else await new Promise((r) => setTimeout(r, 2500));
    if (Date.now() - lastRetention > 60000) {
      lastRetention = Date.now();
      await retention();
    }
  }
}
main().catch(() => {
  console.error("WORKER_STARTUP_FAILED");
  process.exitCode = 1;
});
