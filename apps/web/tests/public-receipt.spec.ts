import { test, expect } from "@playwright/test";
import axe from "axe-core";
// Server-side RPC fixture is configured only for the local production-test server.
test.skip(
  !!process.env.PLAYWRIGHT_BASE_URL,
  "Public SSR fixtures are not injected into an external deployment",
);
test("anonymous receipt is server-rendered and loads no wallet/private endpoints", async ({
  page,
}) => {
  const forbidden: string[] = [];
  page.on("request", (r) => {
    if (
      /\/api\/(private|auth|session|workspace)|repository\/manifest/.test(
        r.url(),
      )
    )
      forbidden.push(r.url());
  });
  const response = await page.goto("/receipts/pass-2-order");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Public receipt", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Seller payment confirmed" }),
  ).toBeVisible();
  await expect(page.getByText("0.010", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Historical buyer", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "teammate.testnet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Connect to continue" }),
  ).toHaveCount(0);
  expect(await response!.text()).not.toContain("PRIVATE_FIXTURE_SECRET");
  expect(await page.content()).not.toContain("PRIVATE_FIXTURE_SECRET");
  expect(forbidden).toEqual([]);
});
test("Automatic receipt explains advance authorization and does not offer approval action", async ({
  page,
}) => {
  await page.goto("/receipts/pass-7-order");
  await expect(page.getByText("Automatic", { exact: true })).toBeVisible();
  await expect(page.getByText(/without a final wallet approval/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve payment" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Seller payment confirmed" }),
  ).toBeVisible();
});
test("pending and refunded receipts never claim seller payment confirmation", async ({
  page,
}) => {
  await page.goto("/receipts/pass-8-order");
  await expect(
    page.getByRole("heading", { name: "Payment pending", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Seller payment confirmed" }),
  ).toHaveCount(0);
  await page.goto("/receipts/pass-9-order");
  await expect(
    page.getByRole("heading", { name: "Service allocation refunded" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Seller payment confirmed" }),
  ).toHaveCount(0);
});
test("legacy receipt link redirects publicly while private workspace stays gated", async ({
  page,
}) => {
  await page.goto("/app/receipts/pass-2-order");
  await expect(page).toHaveURL(/\/receipts\/pass-2-order$/);
  await expect(
    page.getByRole("heading", { name: "Public receipt", exact: true }),
  ).toBeVisible();
  await page.route("**/repository/manifest.json", (r) =>
    r.fulfill({ json: { wallets: [], version: "1.0.0" } }),
  );
  await page.getByRole("link", { name: "Open private workspace" }).click();
  await expect(page).toHaveURL(/\/app\/orders\/pass-2-order$/);
  await expect(
    page.getByRole("heading", { name: "Connect to continue" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Manual payment needs your approval; Automatic payment uses/,
    ),
  ).toBeVisible();
});
test("public API ignores session cookies and excludes private fields; private endpoint remains 401", async ({
  request,
}) => {
  const plain = await request.get("/api/receipt/pass-7-order"),
    signed = await request.get("/api/receipt/pass-7-order", {
      headers: { Cookie: "pb_session=fixture-cookie-that-must-not-be-read" },
    });
  expect(plain.status()).toBe(200);
  expect(signed.status()).toBe(200);
  expect(await signed.json()).toEqual(await plain.json());
  const data = await plain.json();
  expect(data.order_phase).toBe("Paid");
  expect(data.payment_mode).toBe("Automatic");
  expect(data).not.toHaveProperty("job");
  expect(data).not.toHaveProperty("result");
  expect(JSON.stringify(data)).not.toContain("PRIVATE_FIXTURE_SECRET");
  expect((await request.get("/api/private/pass-7-order")).status()).toBe(401);
});
test("unavailable and missing records have honest public states", async ({
  page,
  request,
}) => {
  await page.goto("/receipts/pass-503-order");
  await expect(
    page.getByRole("heading", { name: "Receipt temporarily unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh receipt" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Seller payment confirmed" }),
  ).toHaveCount(0);
  expect((await request.get("/api/receipt/pass-503-order")).status()).toBe(503);
  expect((await request.get("/api/receipt/pass-404-order")).status()).toBe(404);
});
test("public receipt works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/receipts/pass-2-order");
    await expect(
      page.getByRole("heading", { name: "Seller payment confirmed" }),
    ).toBeVisible();
    await expect(page.getByText("0.010", { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});
test("public receipt is readable and accessible on desktop and mobile", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/receipts/pass-7-order");
    await expect(
      page.getByRole("heading", { name: "Seller payment confirmed" }),
    ).toBeVisible();
    await page
      .getByText("Onchain commitments and source", { exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.addScriptTag({ content: axe.source });
    const results = await page.evaluate(
      async () => await (window as unknown as { axe: typeof axe }).axe.run(),
    );
    expect(
      results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      ),
    ).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath(`receipt-${viewport.width}.png`),
      fullPage: true,
    });
  }
});
