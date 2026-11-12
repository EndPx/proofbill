import { randomBytes } from "node:crypto";
import { verifyMessage } from "near-api-js/nep413";
import { validAccountId } from "@proofbill/shared";
import { db, digest, ensureAccount } from "./index.ts";
import { provider } from "./chain.ts";
export const COOKIE = "pb_session";
export function requireOrigin(req: Request) {
  const expected = process.env.APP_ORIGIN ?? new URL(req.url).origin;
  if (req.headers.get("origin") !== expected)
    throw new Error("ORIGIN_MISMATCH");
}
export async function session(req: Request): Promise<string | null> {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (!token) return null;
  const rows =
    await db()`select account_id from pb_sessions where token_hash=${digest(token)} and expires_at>now()`;
  return rows[0]?.account_id ?? null;
}
export async function revokeSession(req: Request) {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (token)
    await db()`delete from pb_sessions where token_hash=${digest(token)}`;
}
export async function challenge(accountId: string, recipient: string) {
  if (!validAccountId(accountId)) throw new Error("INVALID_ACCOUNT");
  await ensureAccount(accountId);
  const id = randomBytes(20).toString("hex"),
    nonce = randomBytes(32).toString("base64");
  const message = `Sign in to ProofBill.\nNetwork: testnet\nAccount: ${accountId}\nChallenge: ${id}`;
  await db()`insert into pb_challenges(id,account_id,nonce,message,recipient,expires_at) values(${id},${accountId},${nonce},${message},${recipient},now()+interval '5 minutes')`;
  return { id, nonce, message, recipient };
}
export async function authenticate(body: {
  id: string;
  accountId: string;
  publicKey: string;
  signature: string;
}) {
  if (
    !body.id ||
    !body.publicKey ||
    !body.signature ||
    body.signature.length > 200
  )
    throw new Error("INVALID_SIGNATURE_INPUT");
  const rows =
    await db()`select * from pb_challenges where id=${body.id} and account_id=${body.accountId} and used_at is null and expires_at>now()`;
  const c = rows[0];
  if (!c) throw new Error("CHALLENGE_EXPIRED");
  await verifyMessage({
    signerAccountId: body.accountId,
    signerPublicKey: body.publicKey,
    payload: {
      message: c.message,
      nonce: Buffer.from(c.nonce, "base64"),
      recipient: c.recipient,
    },
    signature: Buffer.from(body.signature, "base64"),
    provider: provider(),
  });
  const used =
    await db()`update pb_challenges set used_at=now() where id=${c.id} and used_at is null and expires_at>now() returning id`;
  if (!used.length) throw new Error("CHALLENGE_ALREADY_USED");
  await db()`update pb_accounts set last_verified_at=now() where account_id=${body.accountId}`;
  const token = randomBytes(32).toString("hex");
  await db()`insert into pb_sessions(token_hash,account_id,expires_at) values(${digest(token)},${body.accountId},now()+interval '8 hours')`;
  return token;
}
