import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatNear,
  canTransfer,
  validAccountId,
  type PurchasePass,
} from "./index.js";
test("atomic amounts retain exact integer precision", () => {
  assert.equal(formatNear("12345678901234567890123456789", 6), "12345.678901");
  assert.equal(formatNear("10000000000000000000000"), "0.010");
  assert.throws(() => formatNear("1e24"));
});
test("only unused or financially terminal passes transfer", () => {
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
