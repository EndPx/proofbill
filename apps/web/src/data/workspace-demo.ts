// Local marketing fixtures only. Never use these records in the live workspace or API.
export type DemoOrder = {
  id: string;
  passId: string;
  title: string;
  phase: "Delivered" | "Paid";
  brief: string;
  item: string;
  quantity: number;
  requestedBy: string;
};
export type DemoPass = {
  id: string;
  name: string;
  phase: "Available" | "InUse" | "Completed";
};

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
  },
];
export const demoPasses: DemoPass[] = [
  { id: "demo-pass-001", name: "Workshop supplies", phase: "Completed" },
  { id: "demo-pass-002", name: "Design session materials", phase: "InUse" },
  { id: "demo-pass-003", name: "My next purchase", phase: "Available" },
];
