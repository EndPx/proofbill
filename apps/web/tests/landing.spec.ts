import { expect, test } from "@playwright/test";
import axe from "axe-core";

test("purchase explanation changes and its example stays labelled", async ({
  page,
}) => {
  await page.goto("/");
  const detail = page.getByRole("region", {
    name: "Purchase lifecycle illustration",
  });
  await page.getByRole("button", { name: /Give your agent the brief/ }).click();
  await expect(
    detail.getByText("Illustrative extraction example", { exact: true }),
  ).toBeVisible();
  await expect(detail.getByText("notebooks", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: /Review it. Then approve payment/ })
    .click();
  await expect(
    page.getByRole("link", { name: "View transaction" }),
  ).toHaveAttribute("href", /nearblocks.io\/txns\//);
  await page
    .getByRole("group", { name: "Purchase workflow steps" })
    .getByRole("button", { name: /Fund a Purchase Pass/ })
    .click();
  await expect(
    detail.getByText("Separate storage budget", { exact: true }),
  ).toBeVisible();
});

test("FAQ works from the keyboard and the CTA reaches the wallet gate", async ({
  page,
}) => {
  await page.goto("/");
  const question = page
    .locator("summary")
    .filter({ hasText: "Do I need a NEAR wallet?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/Yes. Connect a testnet wallet before entering/),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Open ProofBill", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Connect to continue" }),
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
});

test("handover illustration moves the rights and can be reset", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Preview a handover" }).click();
  await expect(
    page.getByText("Teammate holds the rights. Previous agent cleared.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Illustrative handover", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset preview" }).click();
  await expect(
    page.getByText("You hold the use and refund rights.", { exact: true }),
  ).toBeVisible();
});

test("landing is readable without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL!);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Agents order.",
  );
  await expect(
    page.getByRole("heading", { name: /One pass.*One purchase/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open ProofBill", exact: true }).first(),
  ).toBeVisible();
  await context.close();
});

test("desktop and reduced-motion mobile have no serious accessibility violations or overflow", async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () => {
      const results = await (window as unknown as { axe: typeof axe }).axe.run(
        document,
      );
      return results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) }));
    });
    expect(violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
