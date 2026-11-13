import postgres from "postgres";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
let pool: ReturnType<typeof postgres> | undefined;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  return (pool ??= postgres(process.env.DATABASE_URL, {
    max: 3,
    ssl: { rejectUnauthorized: true },
    prepare: false,
    idle_timeout: 20,
  }));
}
export function digest(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
function key() {
  const k = process.env.ARTIFACT_ENCRYPTION_KEY;
  if (!k || !/^[a-f0-9]{64}$/.test(k))
    throw new Error("ARTIFACT_KEY_NOT_CONFIGURED");
  return Buffer.from(k, "hex");
}
export function seal(value: unknown, context: string): string {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(), iv);
  c.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    c.update(JSON.stringify(value), "utf8"),
    c.final(),
  ]);
  return Buffer.concat([iv, c.getAuthTag(), encrypted]).toString("base64");
}
export function open<T>(value: string, context: string): T {
  const b = Buffer.from(value, "base64");
  if (b.length < 29) throw new Error("INVALID_ARTIFACT");
  const c = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  c.setAuthTag(b.subarray(12, 28));
  c.setAAD(Buffer.from(context));
  return JSON.parse(
    Buffer.concat([c.update(b.subarray(28)), c.final()]).toString("utf8"),
  ) as T;
}
export const chainScope = () =>
  process.env.NEAR_CONTRACT_ID ??
  process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID ??
  "";
export const artifactContext = (
  orderId: string,
  buyer: string,
  contract = chainScope(),
) => `proofbill:v1:testnet:${contract}:${orderId}:${buyer}`;
export interface JobRow {
  job_id: string;
  network: string;
  contract_id: string;
  order_id: string;
  token_id: string;
  buyer_id: string;
  agent_id: string | null;
  revision: number;
  state: string;
  input_cipher: string | null;
  result_cipher: string | null;
  request_commitment: string | null;
  error_code: string | null;
  lease_until: Date | null;
  lease_token: string | null;
  provider_attempted_at: Date | null;
  erased_at: Date | null;
  terminal_at: Date | null;
  updated_at: Date;
  created_at: Date;
}
export async function ensureAccount(accountId: string) {
  await db()`insert into pb_accounts(account_id) values(${accountId}) on conflict(account_id) do nothing`;
}
export async function jobForBuyer(
  orderId: string,
  buyer: string,
): Promise<JobRow | null> {
  const rows = await db()<
    JobRow[]
  >`select * from pb_jobs where order_id=${orderId} and buyer_id=${buyer} and network='testnet' and contract_id=${chainScope()}`;
  return rows[0] ?? null;
}
export function publicJob(j: JobRow) {
  return {
    order_id: j.order_id,
    token_id: j.token_id,
    state: j.state,
    error_code: j.error_code,
    updated_at: j.updated_at,
  };
}
export async function recordObservation(data: {
  orderId?: string | null;
  tokenId?: string | null;
  action: string;
  hash: string;
  signer: string;
  outcome: unknown;
}) {
  await ensureAccount(data.signer);
  const jobs = data.orderId
    ? await db()`select job_id from pb_jobs where network='testnet' and contract_id=${chainScope()} and order_id=${data.orderId}`
    : [];
  const clean = JSON.parse(
    JSON.stringify(data.outcome, (_, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  );
  await db()`insert into pb_chain_observations(job_id,network,contract_id,order_id,token_id,action,tx_hash,signer_id,outcome) values(${jobs[0]?.job_id ?? null},'testnet',${chainScope()},${data.orderId ?? null},${data.tokenId ?? null},${data.action},${data.hash},${data.signer},${db().json(clean)}) on conflict(network,tx_hash) do nothing`;
}
