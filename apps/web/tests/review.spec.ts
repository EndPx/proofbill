import { expect, test } from "@playwright/test";
import axe from "axe-core";

test("public review joins recorded execution to real receipts without wallet initialization", async ({ page }) => {
  const privateCalls: string[] = [];
  page.on("request", request => {
    if (/\/api\/(auth|private|workspace|agent|jobs)(\/|\?|$)/.test(request.url())) privateCalls.push(request.url());
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Review the proof", exact: true }).first().click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByRole("heading", { name: "One budget. Two purchases. A record you can follow." })).toBeVisible();
  await expect(page.getByText("Recorded testnet execution", { exact: true })).toBeVisible();
  await expect(page.getByText(/not a live balance or customer adoption/)).toBeVisible();
  await expect(page.getByText(/1.2345 funded = 0.020 spent/)).toContainText("1.2145 refunded");
  await expect(page.getByText(/The app operator processes plaintext/)).toContainText("does not verify hardware evidence onchain");
  await page.getByRole("link", { name: "Open the Automatic receipt", exact: true }).click();
  await expect(page).toHaveURL(/\/receipts\/pass-13-order-1$/);
  await expect(page.getByRole("heading", { name: "Seller payment confirmed" })).toBeVisible();
  await page.goto("/review");
  await page.getByRole("link", { name: "Order 2 · Manual · 0.010 NEAR", exact: true }).click();
  await expect(page).toHaveURL(/\/receipts\/pass-13-order-2$/);
  await expect(page.getByRole("heading", { name: "Seller payment confirmed" })).toBeVisible();
  expect(privateCalls).toEqual([]);
});

test("review content is available without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Follow the recorded execution." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Order 1 · Automatic · 0.010 NEAR" })).toHaveAttribute("href", "/receipts/pass-13-order-1");
  await context.close();
});

test("mobile review remains readable and keyboard navigable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/review");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const receipt = page.getByRole("link", { name: "Open the Automatic receipt", exact: true });
  await receipt.focus();
  await expect(receipt).toBeFocused();
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const { violations } = await (window as unknown as { axe: typeof axe }).axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    return violations.map(value => value.id);
  });
  expect(violations).toEqual([]);
});
