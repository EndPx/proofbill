import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  db,
  seal,
  open,
  artifactContext,
  jobForBuyer,
  publicJob,
  ensureAccount,
  recordObservation,
  type JobRow,
} from "@/lib/server";
import {
  challenge,
  authenticate,
  session,
  revokeSession,
  requireOrigin,
  COOKIE,
} from "@/lib/server";
import { view, contractId, rpcUrl } from "@/lib/server";
import {
  validAccountId,
  type PurchasePass,
  type PurchaseOrder,
} from "@proofbill/shared";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
const safeError = (e: unknown) =>
  e instanceof Error && /^[A-Z_]+$/.test(e.message)
    ? e.message
    : "SERVICE_UNAVAILABLE";
type Context = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, ctx: Context) {
  try {
    const route = (await ctx.params).path.join("/");
    if (route === "config")
      return json({
        network: "testnet",
        contractId: contractId(),
        agentId:
          process.env.NEAR_AGENT_ID ??
          process.env.NEXT_PUBLIC_NEAR_AGENT_ID ??
          "",
        configured: !!contractId(),
      });
    if (route === "session") return json({ accountId: await session(req) });
    if (route === "workspace") {
      const account = req.nextUrl.searchParams.get("account");
      if (!account || !validAccountId(account))
        return json({ passes: [], orders: [] });
      if (!contractId())
        return json({ passes: [], orders: [], setupRequired: true });
      const [passes, orders] = await Promise.all([
        view<PurchasePass[]>("list_passes", {
          owner_id: account,
          from_index: 0,
          limit: 100,
        }),
        view<PurchaseOrder[]>("list_orders", {
          buyer_id: account,
          from_index: 0,
          limit: 100,
        }),
      ]);
      return json({ passes, orders });
    }
    if (route.startsWith("pass/")) {
      const p = await view<PurchasePass | null>("get_pass", {
        token_id: route.slice(5),
      });
      return p ? json(p) : json({ error: "PASS_NOT_FOUND" }, 404);
    }
    if (route.startsWith("order/")) {
      const id = route.slice(6),
        order = await view<PurchaseOrder | null>("get_order", { order_id: id });
      const refs =
        await db()`select action,tx_hash,signer_id,created_at from pb_chain_observations where order_id=${id} and network='testnet' and contract_id=${contractId()} order by id`;
      const buyer = await session(req);
      const job =
        buyer && (!order || buyer === order.buyer_id)
          ? await jobForBuyer(id, buyer)
          : null;
      if (!order && !job) return json({ error: "ORDER_NOT_FOUND" }, 404);
      return json({
        order,
        observations: refs,
        job: job ? publicJob(job) : null,
      });
    }
    if (route.startsWith("private/")) {
      const id = route.slice(8),
        buyer = await session(req);
      if (!buyer) return json({ error: "AUTHENTICATION_REQUIRED" }, 401);
      const job = await jobForBuyer(id, buyer);
      if (!job) return json({ error: "PRIVATE_RESULT_NOT_FOUND" }, 404);
      if (job.state === "erased")
        return json({ error: "PRIVATE_RESULT_ERASED" }, 410);
      if (!job.result_cipher)
        return json({ job: publicJob(job), result: null });
      const data = open<Record<string, unknown>>(
        job.result_cipher,
        artifactContext(id, buyer, job.contract_id),
      );
      if (req.nextUrl.searchParams.get("export") === "1")
        return new NextResponse(JSON.stringify(data, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="proofbill-${id}.json"`,
            "Cache-Control": "no-store",
          },
        });
      return json({ job: publicJob(job), result: data.result });
    }
    return json({ error: "NOT_FOUND" }, 404);
  } catch (e) {
    return json({ error: safeError(e) }, 503);
  }
}

export async function POST(req: NextRequest, ctx: Context) {
  try {
    requireOrigin(req);
    const route = (await ctx.params).path.join("/");
    if (Number(req.headers.get("content-length") ?? "0") > 32000)
      return json({ error: "REQUEST_TOO_LARGE" }, 413);
    const body = await req.json();
    if (route === "auth/challenge") {
      if (typeof body.accountId !== "string")
        return json({ error: "INVALID_ACCOUNT" }, 400);
      return json(
        await challenge(
          body.accountId,
          new URL(process.env.APP_ORIGIN ?? req.url).host,
        ),
      );
    }
    if (route === "auth/verify") {
      const token = await authenticate(body);
      const res = json({ accountId: body.accountId });
      res.cookies.set(COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 8 * 60 * 60,
      });
      return res;
    }
    if (route === "auth/logout") {
      await revokeSession(req);
      const res = json({ ok: true });
      res.cookies.delete(COOKIE);
      return res;
    }
    const buyer = await session(req);
    if (!buyer) return json({ error: "AUTHENTICATION_REQUIRED" }, 401);
    if (route === "jobs") {
      if (
        typeof body.tokenId !== "string" ||
        typeof body.input !== "string" ||
        body.input.trim().length < 8 ||
        body.input.length > 8000
      )
        return json({ error: "INVALID_PRIVATE_BRIEF" }, 400);
      const p = await view<PurchasePass | null>("get_pass", {
        token_id: body.tokenId,
      });
      if (!p || p.owner_id !== buyer)
        return json({ error: "HOLDER_ONLY" }, 403);
      if (
        p.phase !== "Available" ||
        p.transfer_pending ||
        BigInt(p.expires_at_ns) <= BigInt(Date.now()) * 1000000n
      )
        return json({ error: "PASS_NOT_AVAILABLE" }, 409);
      if (
        p.agent_id !==
        (process.env.NEAR_AGENT_ID ?? process.env.NEXT_PUBLIC_NEAR_AGENT_ID)
      )
        return json({ error: "ASSIGN_AGENT_FIRST" }, 409);
      const recent =
        await db()`select count(*)::int as count from pb_jobs where buyer_id=${buyer} and created_at>now()-interval '24 hours'`;
      if (recent[0].count >= 10)
        return json({ error: "DAILY_SERVICE_LIMIT" }, 429);
      const id = `${p.token_id}-order`,
        input = seal(
          {
            input: body.input.trim(),
            salt: randomBytes(32).toString("hex"),
            nonce: randomBytes(16).toString("hex"),
          },
          artifactContext(id, buyer),
        );
      await ensureAccount(buyer);
      const rows = await db()<
        JobRow[]
      >`insert into pb_jobs(contract_id,order_id,token_id,buyer_id,revision,input_cipher) values(${contractId()},${id},${p.token_id},${buyer},${p.authorization_revision},${input}) on conflict(network,contract_id,order_id) do nothing returning *`;
      if (!rows[0]) return json({ error: "ORDER_ALREADY_QUEUED" }, 409);
      return json({ job: publicJob(rows[0]) }, 201);
    }
    if (route === "observe") {
      if (
        typeof body.hash !== "string" ||
        !/^[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(body.hash)
      )
        return json({ error: "INVALID_TRANSACTION_HASH" }, 400);
      const r = await fetch(rpcUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "receipt",
          method: "tx",
          params: {
            tx_hash: body.hash,
            sender_account_id: buyer,
            wait_until: "FINAL",
          },
        }),
        signal: AbortSignal.timeout(20000),
      });
      const raw = await r.json(),
        outcome = raw.result;
      if (
        !outcome ||
        outcome.transaction.receiver_id !== contractId() ||
        outcome.transaction.signer_id !== buyer
      )
        return json({ error: "TRANSACTION_MISMATCH" }, 400);
      if (outcome.transaction.actions.length !== 1)
        return json({ error: "ONE_CALL_PER_TRANSACTION_REQUIRED" }, 400);
      const action = outcome.transaction.actions.find(
        (a: Record<string, unknown>) => a.FunctionCall,
      )?.FunctionCall;
      if (!action) return json({ error: "NO_CONTRACT_CALL" }, 400);
      const args = JSON.parse(Buffer.from(action.args, "base64").toString());
      await recordObservation({
        orderId: args.order_id ?? null,
        tokenId: args.token_id ?? null,
        action: action.method_name,
        hash: body.hash,
        signer: buyer,
        outcome,
      });
      return json({ recorded: true });
    }
    if (route === "erase") {
      if (typeof body.orderId !== "string")
        return json({ error: "INVALID_ORDER" }, 400);
      const o = await view<PurchaseOrder | null>("get_order", {
        order_id: body.orderId,
      });
      if (!o || o.buyer_id !== buyer) return json({ error: "BUYER_ONLY" }, 403);
      if (!["Paid", "Refunded"].includes(o.phase))
        return json({ error: "SETTLE_OR_REFUND_FIRST" }, 409);
      await db()`update pb_jobs set input_cipher=null,result_cipher=null,state='erased',erased_at=now(),updated_at=now() where order_id=${o.order_id} and buyer_id=${buyer} and contract_id=${contractId()}`;
      return json({ erased: true });
    }
    return json({ error: "NOT_FOUND" }, 404);
  } catch (e) {
    return json({ error: safeError(e) }, 400);
  }
}
