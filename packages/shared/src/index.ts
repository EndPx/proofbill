export const SERVICE_ID = "private-extraction-v1";
export const POLICY_ID = "near-tee-ecdsa-v1";
export const MODEL_ID = "Qwen/Qwen3.8-27B";
export const SERVICE_PRICE = "10000000000000000000000";
export const STORAGE_BUDGET = "30000000000000000000000";
export type PassPhase =
  | "Available"
  | "InUse"
  | "Completed"
  | "RefundPending"
  | "Refunded"
  | "RefundFailed";
export type OrderPhase =
  | "Reserved"
  | "Delivered"
  | "PaymentPending"
  | "Paid"
  | "TransferFailed"
  | "RefundPending"
  | "Refunded"
  | "RefundFailed";
export interface PurchasePass {
  token_id: string;
  owner_id: string;
  seller_id: string;
  model_id: string;
  price_yocto: string;
  expires_at_ns: string;
  authorization_revision: number;
  agent_id: string | null;
  phase: PassPhase;
  order_id: string | null;
  storage_credit_yocto: string;
  transfer_pending: boolean;
  attempt: number;
}
export interface PurchaseOrder {
  order_id: string;
  token_id: string;
  buyer_id: string;
  agent_id: string;
  seller_id: string;
  price_yocto: string;
  revision: number;
  request_commitment: string;
  response_commitment: string | null;
  evidence_commitment: string | null;
  policy_id: string | null;
  phase: OrderPhase;
  attempt: number;
  created_at_ns: string;
}
export interface EvidenceCheck {
  name: string;
  state: "passed" | "failed" | "unavailable" | "not_checked";
  detail?: string;
}
export interface PrivateResult {
  output: Record<string, unknown>;
  checks: EvidenceCheck[];
  scope: string[];
  model: string;
}
export function formatNear(raw: string, places = 3): string {
  if (!/^(0|[1-9]\d*)$/.test(raw)) throw new Error("Invalid atomic amount");
  const n = BigInt(raw),
    scale = 10n ** 24n;
  return `${n / scale}.${(n % scale).toString().padStart(24, "0").slice(0, places)}`;
}
export function isExpired(
  pass: Pick<PurchasePass, "expires_at_ns">,
  now = Date.now(),
): boolean {
  return BigInt(pass.expires_at_ns) <= BigInt(now) * 1000000n;
}
export function canTransfer(pass: PurchasePass, now = Date.now()): boolean {
  return (
    !pass.transfer_pending &&
    ((pass.phase === "Available" && !isExpired(pass, now)) ||
      pass.phase === "Completed" ||
      pass.phase === "Refunded")
  );
}
export function validAccountId(value: string): boolean {
  return (
    value.length >= 2 &&
    value.length <= 64 &&
    /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(value)
  );
}
export function humanPhase(phase: string): string {
  return phase.replace(/([a-z])([A-Z])/g, "$1 $2");
}
