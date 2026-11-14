import { expect, test } from "@playwright/test";

test("session/private/export successes and errors never opt into shared caching", async ({ request, baseURL }) => {
  for (const path of ["/api/config", "/api/session", "/api/private/pass-13-order-1", "/api/private/pass-13-order-1?export=1"]) {
    const response = await request.get(path);
    const headers = response.headers();
    expect(headers["cache-control"]).toContain("private");
    expect(headers["cache-control"]).toContain("no-store");
    expect(headers.pragma).toBe("no-cache");
    expect(headers.expires).toBe("0");
    expect(headers.vary.toLowerCase()).toContain("cookie");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    if (path.startsWith("/api/private")) {
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ error: "AUTHENTICATION_REQUIRED" });
      expect(headers["content-disposition"]).toBeUndefined();
    }
  }
  const originRefusal = await request.post("/api/jobs", { headers: { Origin: "https://attacker.invalid" }, data: { input: "synthetic-private-marker" } });
  expect(originRefusal.status()).toBe(400);
  expect(await originRefusal.json()).toEqual({ error: "ORIGIN_MISMATCH" });
  expect(originRefusal.headers()["cache-control"]).toContain("no-store");
  const anonymous = await request.post("/api/jobs", { headers: { Origin: baseURL! }, data: { tokenId: "pass-13", input: "synthetic-private-marker" } });
  expect(anonymous.status()).toBe(401);
  expect(await anonymous.text()).not.toContain("synthetic-private-marker");
});

test("private workspace cannot be framed and public receipts remain anonymously readable", async ({ page, request }) => {
  const response = await page.goto("/app/purchases");
  expect(response!.headers()["x-frame-options"]).toBe("DENY");
  expect(response!.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response!.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { name: "Connect to continue" })).toBeVisible();
  const receipt = await request.get("/api/receipt/pass-13-order-1");
  expect(receipt.status()).toBe(200);
  expect((await receipt.json()).order_id).toBe("pass-13-order-1");
});
