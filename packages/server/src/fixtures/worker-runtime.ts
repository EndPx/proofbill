// Durable fake RPC/provider boundaries for process-crash tests; never imported by the live worker.
import postgres from "postgres";
import {
  MODEL_ID,
  type PurchaseOrder,
  type PurchasePass,
} from "@proofbill/shared";
import type { WorkerRuntime } from "../../../../workers/agent/src/runner.ts";

export const contract = "worker-check.testnet",
  agent = "agent.worker-check.testnet";
export function fixtureSql() {
  const url = process.env.QUEUE_TEST_DATABASE_URL;
  const schema = process.env.WORKER_FIXTURE_SCHEMA;
  if (
    !url ||
    new URL(url).pathname !== "/proofbill_queue_check" ||
    !schema ||
    !/^worker_[a-f0-9]{16}$/.test(schema)
  )
    throw new Error("ISOLATED_WORKER_FIXTURE_REQUIRED");
  return postgres(url, { max: 3, connection: { search_path: schema } });
}
export function fixtureRuntime(
  sql: ReturnType<typeof postgres>,
  options: {
    delayMs?: number;
    leaseMs?: number;
    heartbeatMs?: number;
    crash?: string;
    afterPublishOwner?: string;
  } = {},
): WorkerRuntime {
  const crash = (stage: string) => {
    if (options.crash === stage) {
      process.kill(process.pid, "SIGKILL");
      throw new Error("TEST_CRASH_DID_NOT_STOP");
    }
  };
  return {
    sql,
    contract,
    agent,
    leaseMs: options.leaseMs,
    heartbeatMs: options.heartbeatMs,
    retryMs: 20,
    async view<T>(method: string, args: Record<string, unknown>): Promise<T> {
      if (method === "get_pass") crash("claimed");
      const token = String(
        args.token_id ?? String(args.order_id).replace(/-order$/, ""),
      );
      const [row] =
        await sql`select * from worker_chain where token_id=${token}`;
      return (
        method === "get_pass"
          ? JSON.parse(row.pass_json)
          : row.order_json
            ? JSON.parse(row.order_json)
            : null
      ) as T;
    },
    async call(role, method, args) {
      const token = String(
        args.token_id ?? String(args.order_id).replace(/-order$/, ""),
      );
      if (role === "publisher") crash("saved");
      await sql.unsafe(
        `update worker_chain set ${role === "agent" ? "reservation_calls" : "publish_calls"}=${role === "agent" ? "reservation_calls" : "publish_calls"}+1 where token_id=$1`,
        [token],
      );
      await sql.begin(async (tx) => {
        const [row] = await tx.unsafe(
          "select * from worker_chain where token_id=$1 for update",
          [token],
        );
        const pass = JSON.parse(row.pass_json) as PurchasePass;
        let order = row.order_json
          ? (JSON.parse(row.order_json) as PurchaseOrder)
          : null;
        if (role === "agent") {
          if (
            order ||
            pass.phase !== "Available" ||
            args.expected_revision !== pass.authorization_revision
          )
            throw new Error("FIXTURE_INVALID_RESERVATION");
          order = {
            order_id: `${token}-order`,
            token_id: token,
            buyer_id: pass.owner_id,
            agent_id: agent,
            seller_id: pass.seller_id,
            price_yocto: pass.price_yocto,
            revision: pass.authorization_revision,
            request_commitment: String(args.request_commitment),
            response_commitment: null,
            evidence_commitment: null,
            policy_id: null,
            phase: "Reserved",
            attempt: 0,
            created_at_ns: "1",
          };
          pass.phase = "InUse";
          pass.order_id = order.order_id;
        } else {
          if (
            !order ||
            order.phase !== "Reserved" ||
            order.request_commitment !== args.request_commitment
          )
            throw new Error("FIXTURE_DUPLICATE_PUBLICATION");
          order.response_commitment = String(args.response_commitment);
          order.evidence_commitment = String(args.evidence_commitment);
          order.policy_id = String(args.policy_id);
          order.phase =
            pass.payment_mode === "Automatic" ? "Paid" : "Delivered";
          if (order.phase === "Paid") {
            order.attempt = 1;
            pass.phase = "Completed";
            await tx.unsafe(
              "update worker_chain set payments=payments+1 where token_id=$1",
              [token],
            );
          }
          if (options.afterPublishOwner) {
            pass.owner_id = options.afterPublishOwner;
            pass.authorization_revision++;
            pass.agent_id = null;
          }
        }
        await tx.unsafe(
          "update worker_chain set pass_json=$1,order_json=$2 where token_id=$3",
          [JSON.stringify(pass), JSON.stringify(order), token],
        );
      });
      crash(role === "agent" ? "reserved" : "published");
      return { hash: "fixture-public-transaction" };
    },
    async infer(body, signal) {
      const request = JSON.parse(body.toString());
      const token = /pass ([^;]+);/.exec(request.messages[0].content)?.[1];
      await sql`update worker_chain set provider_calls=provider_calls+1 where token_id=${token!}`;
      crash("running");
      if (options.delayMs)
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            signal.removeEventListener("abort", abort);
            resolve();
          }, options.delayMs);
          const abort = () => {
            clearTimeout(timer);
            reject(new Error("WORKER_LEASE_LOST"));
          };
          signal.addEventListener("abort", abort, { once: true });
        });
      return {
        ok: true,
        signature_kind: "provider_tee",
        result: {
          model: MODEL_ID,
          output: { quantity: 12 },
          checks: [],
          scope: ["synthetic fixture, not real attestation"],
        },
        artifacts: {
          response_base64: Buffer.from(
            JSON.stringify({ fixture: true, quantity: 12 }),
          ).toString("base64"),
        },
      };
    },
  };
}
