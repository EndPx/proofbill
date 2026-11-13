// Local marketing fixtures only. Never use these records in the live workspace or API.
import { SERVICE_PRICE, type PaymentMode } from "@proofbill/shared";
export type DemoOrder = {
  id: string;
  passId: string;
  title: string;
  phase: "Delivered" | "Paid";
  brief: string;
  item: string;
  quantity: number;
  requestedBy: string;
  paymentMode: PaymentMode;
  agent: string;
  maxOrderPrice?: string | null;
};
export type DemoPass = {
  id: string;
  name: string;
  phase: "Available" | "InUse" | "Completed" | "Refunded";
  budget: string;
  paymentMode: PaymentMode;
  agent: string;
  maxOrderPrice?: string | null;
  refunded?: string;
};
export function demoLedger(pass: DemoPass, orders: DemoOrder[]) {
  const own = orders.filter(order=>order.passId===pass.id);
  const spent = BigInt(own.filter(order=>order.phase==="Paid").length)*BigInt(SERVICE_PRICE);
  const reserved = BigInt(own.filter(order=>order.phase==="Delivered").length)*BigInt(SERVICE_PRICE);
  const refunded=BigInt(pass.refunded??"0");
  return {spent,reserved,refunded,available:BigInt(pass.budget)-spent-reserved-refunded};
}

export const demoOrders: DemoOrder[] = [
  {
    id: "demo-order-001",
    passId: "demo-pass-001",
    title: "Workshop supplies",
    phase: "Paid",
    brief: "Order 12 workshop notebooks for Community team.",
    item: "workshop notebooks",
    quantity: 12,
    requestedBy: "Community team",
    paymentMode: "Manual", agent: "ProofBill assistant",
  },
  {
    id: "demo-order-002",
    passId: "demo-pass-002",
    title: "Design session materials",
    phase: "Delivered",
    brief: "Order 6 marker sets for Design team.",
    item: "marker sets",
    quantity: 6,
    requestedBy: "Design team",
    paymentMode: "Manual", agent: "ProofBill assistant",
  },
];
export const demoPasses: DemoPass[] = [
  { id: "demo-pass-001", name: "Workshop supplies", phase: "Available", budget:"50000000000000000000000", paymentMode:"Manual",agent:"ProofBill assistant" },
  { id: "demo-pass-002", name: "Design session materials", phase: "InUse", budget:"30000000000000000000000", paymentMode:"Manual",agent:"ProofBill assistant" },
  { id: "demo-pass-003", name: "My next purchase", phase: "Available", budget:"30000000000000000000000", paymentMode:"Manual",agent:"" },
];
