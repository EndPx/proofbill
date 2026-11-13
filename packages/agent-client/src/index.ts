import { randomBytes, createHash } from "node:crypto";
import { Account, KeyPairSigner, JsonRpcProvider, actions } from "near-api-js";
import {
  inferenceRequest,
  type PrivateBrief,
  type PurchasePass,
  type PurchaseOrder,
} from "@proofbill/shared";

export function makeAgentBrief(input: string): PrivateBrief {
  return {
    input: input.trim(),
    salt: randomBytes(32).toString("hex"),
    nonce: randomBytes(16).toString("hex"),
  };
}
// Keep the brief (including its nonce/salt) in private local storage until submission succeeds.
export async function runOwnAgent(options: {
  baseUrl: string;
  contractId: string;
  agentId: string;
  signer: KeyPairSigner;
  provider: JsonRpcProvider;
  tokenId: string;
  brief: PrivateBrief;
}) {
  const { contractId, agentId, signer, provider, tokenId, brief } = options;
  const base = options.baseUrl.replace(/\/$/, ""),
    origin = new URL(base).origin;
  let cookie = "";
  async function post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${base}/api/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        typeof data.error === "string" ? data.error : "AGENT_API_UNAVAILABLE",
      );
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return data as T;
  }
  const config = await (
    await fetch(`${base}/api/config`, { signal: AbortSignal.timeout(15000) })
  ).json();
  if (
    config.network !== "testnet" ||
    config.contractId !== contractId ||
    !config.advancedModes
  )
    throw new Error("AGENT_SERVICE_CONFIGURATION_MISMATCH");
  const challenge = await post<{
    id: string;
    message: string;
    recipient: string;
    nonce: string;
  }>("auth/challenge", { accountId: agentId });
  if (
    challenge.recipient !== new URL(base).host ||
    !/^[a-f0-9]{40}$/.test(challenge.id) ||
    Buffer.from(challenge.nonce, "base64").length !== 32 ||
    challenge.message !==
      `Sign in to ProofBill.\nNetwork: testnet\nAccount: ${agentId}\nChallenge: ${challenge.id}`
  )
    throw new Error("AUTH_CHALLENGE_MISMATCH");
  const signed = await signer.signNep413Message(agentId, {
    message: challenge.message,
    recipient: challenge.recipient,
    nonce: Buffer.from(challenge.nonce, "base64"),
  });
  await post("auth/verify", {
    id: challenge.id,
    accountId: agentId,
    publicKey: signed.publicKey.toString(),
    signature: Buffer.from(signed.signature).toString("base64"),
  });
  async function read<T>(
    method: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    return (await provider.callFunction({
      contractId,
      method,
      args,
      blockQuery: { finality: "final" },
    })) as T;
  }
  const pass = await read<PurchasePass | null>("get_pass", {
    token_id: tokenId,
  });
  if (!pass || pass.agent_id !== agentId || pass.transfer_pending)
    throw new Error("AGENT_NOT_AUTHORIZED");
  const orderId = `${tokenId}-order`,
    revision = pass.authorization_revision;
  const requestCommitment = createHash("sha256")
    .update(
      Buffer.concat([
        Buffer.from("proofbill:v1:request:"),
        Buffer.from(brief.salt, "hex"),
        Buffer.from(
          JSON.stringify(inferenceRequest(orderId, tokenId, revision, brief)),
        ),
      ]),
    )
    .digest("hex");
  let order = await read<PurchaseOrder | null>("get_order", {
    order_id: orderId,
  });
  let reservationTx: string | null = null;
  if (!order) {
    const prepared = await post<{
      reservation: { request_commitment: string };
    }>("agent/prepare", { tokenId, revision, ...brief });
    if (prepared.reservation.request_commitment !== requestCommitment)
      throw new Error("REQUEST_COMMITMENT_MISMATCH");
    const account = new Account(agentId, provider, signer);
    const outcome = await account.signAndSendTransaction({
      receiverId: contractId,
      actions: [
        actions.functionCall(
          "reserve_order",
          {
            token_id: tokenId,
            expected_revision: revision,
            request_commitment: requestCommitment,
          },
          100000000000000n,
          0n,
        ),
      ],
      waitUntil: "FINAL",
      throwOnFailure: true,
      retries: 0,
    });
    reservationTx = outcome.transaction.hash;
    order = await read<PurchaseOrder>("get_order", { order_id: orderId });
  }
  if (
    !order ||
    order.buyer_id !== pass.owner_id ||
    order.agent_id !== agentId ||
    order.revision !== revision ||
    order.request_commitment !== requestCommitment
  )
    throw new Error("ORDER_RESERVATION_MISMATCH");
  const submitted = await post<{ job: { state: string } }>("agent/submit", {
    tokenId,
  });
  return { orderId, reservationTx, state: submitted.job.state };
}
