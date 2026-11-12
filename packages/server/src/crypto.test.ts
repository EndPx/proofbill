import { test } from "node:test";
import assert from "node:assert/strict";
import { seal, open } from "./index.ts";
test("private artifacts preserve bytes and bind buyer/order", () => {
  process.env.ARTIFACT_ENCRYPTION_KEY = "a".repeat(64);
  const value = { raw: "\r\nprivate result \n" };
  const c = seal(value, "order-1:alice");
  assert.equal(c.includes("private"), false);
  assert.deepEqual(open(c, "order-1:alice"), value);
  assert.throws(() => open(c, "order-1:bob"));
  const damaged = Buffer.from(c, "base64");
  damaged[damaged.length - 1] ^= 1;
  assert.throws(() => open(damaged.toString("base64"), "order-1:alice"));
});
