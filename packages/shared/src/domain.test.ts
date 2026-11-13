import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatNear,
  canTransfer,
  validAccountId,
  parseNearAmount,
  budgetFunding,
  nextOrderId,
  parseOrderPriceLimit,
  type PurchasePass,
} from "./index.js";
test("budget quotes separate service allocation from storage with exact atomic amounts", () => {
  const amount = parseNearAmount("0.050");
  assert.equal(amount, "50000000000000000000000");
  assert.deepEqual(budgetFunding(amount), {
    orders: 5, storage: "80000000000000000000000", total: "130000000000000000000000",
  });
  for (const value of ["1e-2", "-0.01", "0.015", "0", "1.01", "0.0000000000000000000000001"])
    assert.throws(() => budgetFunding(parseNearAmount(value)));
  assert.equal(nextOrderId({token_id:"pass-1"}),"pass-1-order");
  assert.equal(nextOrderId({token_id:"pass-1",budget:{orders_created:2} as PurchasePass["budget"]}),"pass-1-order-3");
});
test("flexible budgets accept custom totals and decouple initial storage from spending authority",()=>{
  assert.deepEqual(budgetFunding(parseNearAmount("1"),{flexible:true}),{orders:100,storage:"30000000000000000000000",total:"1030000000000000000000000"});
  assert.deepEqual(budgetFunding(parseNearAmount("1.2345"),{flexible:true}),{orders:123,storage:"30000000000000000000000",total:"1264500000000000000000000"});
  assert.equal(budgetFunding(parseNearAmount("1.2345"),{flexible:true,storageBudget:parseNearAmount("0.1")}).total,"1334500000000000000000000");
  assert.equal(parseOrderPriceLimit("0.1"),"100000000000000000000000");
  for(const raw of ["","0","-1","1e-2"])assert.throws(()=>parseOrderPriceLimit(raw),/INVALID_PRICE_LIMIT/);
  assert.throws(()=>budgetFunding(((1n<<128n)-1n).toString(),{flexible:true}));
  assert.throws(()=>budgetFunding(parseNearAmount("1"),{flexible:true,storageBudget:"1"}),/INVALID_STORAGE_BACKING/);
});
test("atomic amounts retain exact integer precision", () => {
  assert.equal(formatNear("12345678901234567890123456789", 6), "12345.678901");
  assert.equal(formatNear("10000000000000000000000"), "0.010");
  assert.throws(() => formatNear("1e24"));
});
test("only available or financially terminal passes transfer", () => {
  const p = {
    phase: "Available",
    expires_at_ns: "2000000000000000000",
    transfer_pending: false,
  } as PurchasePass;
  assert.equal(canTransfer(p, 1000), true);
  assert.equal(canTransfer({ ...p, phase: "InUse" }, 1000), false);
  assert.equal(canTransfer({ ...p, transfer_pending: true }, 1000), false);
  assert.equal(canTransfer({ ...p, expires_at_ns: "0" }, 1000), false);
  assert.equal(validAccountId("alice.testnet"), true);
  assert.equal(validAccountId("not an account"), false);
});
