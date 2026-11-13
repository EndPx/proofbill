import {
  Account,
  JsonRpcProvider,
  KeyPairSigner,
  actions,
  type KeyPairString,
} from "near-api-js";
import { recordObservation } from "./index.ts";
export const rpcUrl = () =>
  process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com";
export const contractId = () =>
  process.env.NEAR_CONTRACT_ID ??
  process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID ??
  "";
export const provider = () =>
  new JsonRpcProvider({ url: rpcUrl() }, { retries: 1, wait: 500, backoff: 1 });
export async function view<T>(
  method: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!contractId()) throw new Error("CONTRACT_NOT_CONFIGURED");
  return (await provider().callFunction({
    contractId: contractId(),
    method,
    args,
    blockQuery: { finality: "final" },
  })) as T;
}
export async function call(
  role: "agent" | "publisher",
  method: string,
  args: Record<string, unknown>,
) {
  const accountId =
    process.env[role === "agent" ? "NEAR_AGENT_ID" : "NEAR_PUBLISHER_ID"];
  const privateKey =
    process.env[role === "agent" ? "NEAR_AGENT_KEY" : "NEAR_PUBLISHER_KEY"];
  if (!accountId || !privateKey)
    throw new Error("WORKER_SIGNER_NOT_CONFIGURED");
  const account = new Account(
    accountId,
    provider(),
    KeyPairSigner.fromSecretKey(privateKey as KeyPairString),
  );
  const outcome = await account.signAndSendTransaction({
    receiverId: contractId(),
    actions: [actions.functionCall(method, args, 100000000000000n, 0n)],
    waitUntil: "FINAL",
    throwOnFailure: true,
    retries: 0,
  });
  const hash = outcome.transaction.hash;
  const reserved = typeof args.token_id === "string" && method === "reserve_order"
    ? await view<{ order_id: string | null }>("get_pass", { token_id: args.token_id }) : null;
  await recordObservation({
    orderId:
      typeof args.order_id === "string"
        ? args.order_id
        : typeof args.token_id === "string"
          ? reserved?.order_id ?? `${args.token_id}-order`
          : null,
    tokenId: typeof args.token_id === "string" ? args.token_id : null,
    action: method,
    hash,
    signer: accountId,
    outcome,
  });
  return { hash, outcome };
}
