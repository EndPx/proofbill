import {
  validAccountId,
  formatReceiptNear,
  type PublicReceipt,
  type PurchaseOrder,
  type PurchasePass,
} from "@proofbill/shared";
import { db } from "./index.ts";
import { contractId, provider } from "./chain.ts";

export class ReceiptUnavailable extends Error {
  constructor() {
    super("RECEIPT_UNAVAILABLE");
  }
}
type Reader = {
  contract: string;
  block: { hash: string; height: number };
  order(id: string): Promise<PurchaseOrder | null | undefined>;
  pass(id: string): Promise<PurchasePass | null | undefined>;
  references(id: string): Promise<Record<string, unknown>[]>;
};
const phasePairs: Record<string, string> = {
  Reserved: "InUse",
  Delivered: "InUse",
  PaymentPending: "InUse",
  Paid: "Completed",
  TransferFailed: "InUse",
  RefundPending: "RefundPending",
  Refunded: "Refunded",
  RefundFailed: "RefundFailed",
};
const actions = new Set([
  "reserve_order",
  "publish_delivery",
  "approve_and_pay",
  "retry_failed_payment",
  "cancel_and_refund",
  "retry_failed_refund",
  "nft_transfer",
  "nft_transfer_call",
  "assign_agent",
  "create_purchase_pass",
  "create_budget_pass",
  "create_flexible_budget_pass",
  "configure_budget_agent",
  "top_up_storage",
]);
const hash = (value: unknown) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const optionalHash = (value: unknown) => value === null || hash(value);
export function validReceiptId(id: string) {
  return /^pass-[1-9]\d{0,19}-order(?:-[1-9]\d{0,9})?$/.test(id);
}
function validBudget(pass: PurchasePass, id: string): boolean {
  if (!pass.budget) return !/-order-\d+$/.test(id);
  const b = pass.budget;
  try {
    const amounts = [b.funded_yocto,b.available_yocto,b.reserved_yocto,b.spent_yocto,b.refunded_yocto];
    amounts.forEach(formatReceiptNear);
    const sequence = Number(id.match(/-order-(\d+)$/)?.[1]);
    return Number.isSafeInteger(b.orders_created) && b.orders_created >= sequence && b.orders_created <= 4294967295 && sequence > 0 &&
      BigInt(b.funded_yocto) > 0n && BigInt(b.funded_yocto) === amounts.slice(1).reduce((sum,n)=>sum+BigInt(n),0n) &&
      BigInt(b.reserved_yocto) <= BigInt(pass.price_yocto);
  } catch { return false; }
}

// Explicit projection: this reader has no session/input/result lookup, even for a signed-in buyer.
export async function readPublicReceipt(
  id: string,
  reader: Reader,
): Promise<PublicReceipt | null> {
  if (!validReceiptId(id)) return null;
  const order = await reader.order(id);
  if (!order) return null;
  const pass = await reader.pass(order.token_id);
  const mode = order.payment_mode ?? pass?.payment_mode ?? "Manual";
  const historicalBudgetOrder = !!pass?.budget && ["Paid", "Refunded"].includes(order.phase);
  if (
    !pass ||
    !validBudget(pass, id) ||
    !validAccountId(reader.contract) ||
    !/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(reader.block.hash) ||
    !Number.isSafeInteger(reader.block.height) ||
    reader.block.height < 0 ||
    order.order_id !== id ||
    order.token_id !== id.replace(/-order(?:-\d+)?$/, "") ||
    pass.token_id !== order.token_id ||
    (!historicalBudgetOrder && pass.order_id !== id) ||
    ![order.buyer_id, order.agent_id, order.seller_id, pass.owner_id].every(
      (value) => typeof value === "string" && validAccountId(value),
    ) ||
    pass.seller_id !== order.seller_id ||
    pass.price_yocto !== order.price_yocto ||
    typeof order.price_yocto !== "string" ||
    !phasePairs[order.phase] ||
    (!historicalBudgetOrder && phasePairs[order.phase] !== pass.phase) ||
    (historicalBudgetOrder && !["Available","InUse","Completed","RefundPending","Refunded","RefundFailed"].includes(pass.phase)) ||
    (!!pass.budget && order.payment_mode === undefined) ||
    !["Manual", "Automatic"].includes(mode) ||
    !hash(order.request_commitment) ||
    !optionalHash(order.response_commitment) ||
    !optionalHash(order.evidence_commitment) ||
    !(
      order.policy_id === null ||
      (typeof order.policy_id === "string" &&
        /^[a-z0-9-]{1,100}$/.test(order.policy_id))
    ) ||
    typeof order.created_at_ns !== "string" ||
    !/^(0|[1-9]\d{0,19})$/.test(order.created_at_ns) ||
    BigInt(order.created_at_ns) > (1n << 64n) - 1n
  )
    throw new ReceiptUnavailable();
  try {
    formatReceiptNear(order.price_yocto);
    if(order.max_order_price_yocto!=null){
      formatReceiptNear(order.max_order_price_yocto);
      if(BigInt(order.max_order_price_yocto)<BigInt(order.price_yocto))throw new Error("ORDER_PRICE_LIMIT_EXCEEDED");
    }
  } catch {
    throw new ReceiptUnavailable();
  }
  if (
    ["Delivered", "PaymentPending", "Paid", "TransferFailed"].includes(
      order.phase,
    ) &&
    (!order.response_commitment ||
      !order.evidence_commitment ||
      !order.policy_id)
  )
    throw new ReceiptUnavailable();
  let observations: PublicReceipt["observations"] = [],
    referencesAvailable = true;
  try {
    const rows = await reader.references(id);
    observations = rows.flatMap((row) => {
      if (
        typeof row.action !== "string" ||
        !actions.has(row.action) ||
        typeof row.tx_hash !== "string" ||
        !/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(row.tx_hash) ||
        typeof row.signer_id !== "string" ||
        !validAccountId(row.signer_id)
      )
        return [];
      const date = new Date(row.created_at as string | Date);
      if (!Number.isFinite(date.getTime())) return [];
      return [
        {
          action: row.action,
          tx_hash: row.tx_hash,
          signer_id: row.signer_id,
          created_at: date.toISOString(),
        },
      ];
    });
  } catch {
    referencesAvailable = false;
  }
  return {
    network: "testnet",
    contract_id: reader.contract,
    block_hash: reader.block.hash,
    block_height: reader.block.height,
    order_id: order.order_id,
    token_id: order.token_id,
    buyer_id: order.buyer_id,
    agent_id: order.agent_id,
    seller_id: order.seller_id,
    current_holder: pass.owner_id,
    price_yocto: order.price_yocto,
    created_at_ns: order.created_at_ns,
    payment_mode: mode,
    max_order_price_yocto: order.max_order_price_yocto??null,
    order_phase: order.phase,
    nft_phase: pass.phase,
    request_commitment: order.request_commitment,
    response_commitment: order.response_commitment,
    evidence_commitment: order.evidence_commitment,
    policy_id: order.policy_id,
    observations,
    references_available: referencesAvailable,
  };
}

export async function loadPublicReceipt(
  id: string,
): Promise<PublicReceipt | null> {
  if (!validReceiptId(id)) return null;
  const contract = contractId();
  if (!contract) throw new ReceiptUnavailable();
  const rpc = provider(),
    head = await rpc.viewBlock({ finality: "final" });
  const query = { blockId: head.header.hash };
  return readPublicReceipt(id, {
    contract,
    block: { hash: head.header.hash, height: head.header.height },
    order: (orderId) =>
      rpc.callFunction({
        contractId: contract,
        method: "get_order",
        args: { order_id: orderId },
        blockQuery: query,
      }) as Promise<PurchaseOrder | null>,
    pass: (tokenId) =>
      rpc.callFunction({
        contractId: contract,
        method: "get_pass",
        args: { token_id: tokenId },
        blockQuery: query,
      }) as Promise<PurchasePass | null>,
    references: async (orderId) => {
      if (!process.env.DATABASE_URL) throw new Error("REFERENCES_UNAVAILABLE");
      return db()`select action,tx_hash,signer_id,created_at from pb_chain_observations where order_id=${orderId} and network='testnet' and contract_id=${contract} order by id`;
    },
  });
}
