import assert from "node:assert/strict";
import type { PaymentMode, PurchaseOrder } from "@proofbill/shared";

export function checkOrderUpgrade(before: PurchaseOrder, after: PurchaseOrder, legacyMode?: PaymentMode) {
  for (const [field,value] of Object.entries(before))
    assert.deepEqual((after as unknown as Record<string,unknown>)[field],value);
  const mode=before.payment_mode??legacyMode;
  assert.ok(mode,"Record each order's policy before deployment; do not infer it from a reusable NFT");
  assert.equal(after.payment_mode,mode);
  assert.equal(after.max_order_price_yocto??null,before.max_order_price_yocto??null);
}
