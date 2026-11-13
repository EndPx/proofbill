import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { db, type JobRow } from "@proofbill/server";
import { view, call, contractId } from "@proofbill/server/chain";
import { runOnce, type Inference } from "./runner.ts";
import { type PurchasePass, type PurchaseOrder } from "@proofbill/shared";
const pythonFile = fileURLToPath(
  new URL("../../inference/inference.py", import.meta.url),
);
function infer(body: Buffer, signal: AbortSignal): Promise<Inference> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("WORKER_LEASE_LOST"));
      return;
    }
    const env = { ...process.env };
    for (const name of [
      "NEAR_AGENT_KEY",
      "NEAR_PUBLISHER_KEY",
      "DATABASE_URL",
      "ARTIFACT_ENCRYPTION_KEY",
      "OWN_AGENT_KEY",
    ])
      delete env[name];
    const child = spawn(process.env.PYTHON_BIN ?? "python3", [pythonFile], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "",
      finished = false;
    const finish = (error: Error | null, result?: Inference) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(result!);
    };
    const abort = () => {
      child.kill();
      finish(new Error("WORKER_LEASE_LOST"));
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error("INFERENCE_EXECUTION_UNKNOWN"));
    }, 300000);
    signal.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (buffer) => {
      stdout += buffer.toString();
      if (stdout.length > 8_000_000) {
        child.kill();
        finish(new Error("EVIDENCE_TOO_LARGE"));
      }
    });
    child.stderr.on("data", () => {});
    child.on("error", () => finish(new Error("INFERENCE_RUNTIME_UNAVAILABLE")));
    child.on("close", () => {
      if (finished) return;
      try {
        finish(null, JSON.parse(stdout));
      } catch {
        finish(new Error("INFERENCE_RUNTIME_UNAVAILABLE"));
      }
    });
    child.stdin.on("error", () => {
      child.kill();
      finish(new Error("INFERENCE_RUNTIME_UNAVAILABLE"));
    });
    child.stdin.end(
      JSON.stringify({ request_base64: body.toString("base64") }),
    );
  });
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
  const runtime = {
    sql: db(),
    contract: contractId(),
    agent: process.env.NEAR_AGENT_ID,
    view,
    call,
    infer,
  };
  let lastRetention = 0;
  for (;;) {
    const worked = await runOnce(runtime);
    if (!worked) await new Promise((r) => setTimeout(r, 2500));
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
