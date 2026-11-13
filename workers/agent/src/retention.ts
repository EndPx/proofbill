import type { WorkerRuntime } from "./runner.ts";

export async function runRetention(
  runtime: Pick<WorkerRuntime, "sql" | "contract" | "view">,
) {
  const { sql, contract, view } = runtime;
  // Persist the turn before RPC, so unresolved or failing jobs cannot monopolize a restarted worker.
  const rows = await sql<{ job_id: string; order_id: string; token_id: string }[]>`
    with candidates as (
      select job_id from pb_jobs
      where network='testnet' and contract_id=${contract} and terminal_at is null and erased_at is null
        and state in ('awaiting_reservation','delivered','failed','reconciliation_required')
      order by coalesce(retention_checked_at,created_at),job_id
      limit 20 for update skip locked
    )
    update pb_jobs j set retention_checked_at=now() from candidates c
    where j.job_id=c.job_id returning j.job_id,j.order_id,j.token_id`;
  for (const job of rows) {
    try {
      const order = await view<{ phase: string } | null>("get_order", { order_id: job.order_id });
      const pass = order ? null : await view<{ phase: string } | null>("get_pass", { token_id: job.token_id });
      if ((order && ["Paid", "Refunded"].includes(order.phase)) || pass?.phase === "Refunded")
        await sql`update pb_jobs set terminal_at=now() where job_id=${job.job_id} and terminal_at is null`;
    } catch {
      console.warn(JSON.stringify({ event: "retention_check_unavailable", order_id: job.order_id }));
    }
  }
  await sql`update pb_jobs set input_cipher=null,result_cipher=null,state='erased',erased_at=now(),updated_at=now()
    where network='testnet' and contract_id=${contract} and terminal_at<now()-interval '7 days' and erased_at is null`;
  await sql`delete from pb_challenges where expires_at<now()-interval '1 day'`;
  await sql`delete from pb_sessions where expires_at<now()`;
}
