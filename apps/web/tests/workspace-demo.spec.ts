import { expect, test } from "@playwright/test";
import axe from "axe-core";

test("landing demo menus, tabs, pass creation and reset work without a wallet", async ({
  page,
}) => {
  await page.goto("/");
  const demo = page.getByRole("region", {
    name: "Interactive workspace demo",
    exact: true,
  });
  await expect(
    demo.getByRole("heading", { name: "Example result" }),
  ).toBeVisible();
  const request = demo.getByRole("tab", { name: "Request", exact: true });
  await request.click();
  await expect(demo.getByRole("tabpanel")).toContainText(
    "Order 12 workshop notebooks for Community team.",
  );
  await request.press("ArrowRight");
  await expect(
    demo.getByRole("tab", { name: "Evidence", exact: true }),
  ).toBeFocused();
  await expect(demo.getByRole("tabpanel")).toContainText(
    "not a new verification",
  );
  await demo.getByRole("button", { name: "Purchases", exact: true }).click();
  await demo
    .getByRole("textbox", { name: "Search demo orders" })
    .fill("Design");
  await expect(
    demo.getByRole("button", { name: /demo-order-002/ }),
  ).toBeVisible();
  await expect(
    demo.getByRole("button", { name: /demo-order-001/ }),
  ).toHaveCount(0);
  await demo
    .getByRole("button", { name: "Purchase Passes", exact: true })
    .click();
  await demo
    .getByRole("button", { name: "New demo pass", exact: true })
    .click();
  await demo
    .getByRole("textbox", { name: "Pass name" })
    .fill("Team lunch brief");
  await demo.getByRole("button", { name: "Create demo pass" }).click();
  await expect(
    demo.getByRole("heading", { name: "Team lunch brief", exact: true }),
  ).toBeVisible();
  await expect(demo.getByRole("status")).toContainText(
    "No wallet or funds were used",
  );
  await demo.getByRole("button", { name: "Reset demo" }).click();
  await expect(
    demo.getByRole("heading", { name: "Example result" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open live app", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Connect to continue" }),
  ).toBeVisible();
});

test("demo approval changes only sample records and never submits an API mutation", async ({
  page,
}) => {
  const mutations: string[] = [];
  const liveDataReads: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) {
      if (request.method() !== "GET") mutations.push(request.url());
      if (
        /\/api\/(?:jobs|workspace|order|pass|private|auth)(?:\/|\?|$)/.test(
          request.url(),
        )
      )
        liveDataReads.push(request.url());
    }
  });
  await page.goto("/");
  const demo = page.getByRole("region", {
    name: "Interactive workspace demo",
    exact: true,
  });
  await demo.getByRole("button", { name: "Purchases", exact: true }).click();
  await demo.getByRole("button", { name: /demo-order-002/ }).click();
  await demo.getByRole("button", { name: "Approve in demo" }).click();
  await expect(demo.getByRole("status")).toContainText(
    "local simulation, not a transaction",
  );
  await demo.getByRole("button", { name: "Receipts", exact: true }).click();
  await expect(
    demo.getByRole("button", { name: /demo-order-002/ }),
  ).toBeVisible();
  await demo
    .getByRole("button", { name: "Purchase Passes", exact: true })
    .click();
  const pass = demo.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Design session materials",
      exact: true,
    }),
  });
  await expect(pass).toContainText("Completed");
  await demo.getByRole("button", { name: "Reset demo" }).click();
  await demo.getByRole("button", { name: "Receipts", exact: true }).click();
  await expect(
    demo.getByRole("button", { name: /demo-order-002/ }),
  ).toHaveCount(0);
  expect(mutations).toEqual([]);
  expect(liveDataReads).toEqual([]);
});

test("mobile demo keeps named menus, internal scrolling and accessible controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const demo = page.getByRole("region", {
    name: "Interactive workspace demo",
    exact: true,
  });
  await demo
    .getByRole("button", { name: "Purchase Passes", exact: true })
    .click();
  const scroll = demo.getByRole("region", {
    name: "Demo content",
    exact: true,
  });
  await scroll.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  const box = await scroll.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, 350);
  await expect
    .poll(() => scroll.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await demo.getByRole("button", { name: "Receipts", exact: true }).click();
  await expect
    .poll(() => scroll.evaluate((element) => element.scrollTop))
    .toBe(0);
  await page.addScriptTag({ content: axe.source });
  const violations = await demo.evaluate(async (element) => {
    const results = await (window as unknown as { axe: typeof axe }).axe.run(
      element,
    );
    return results.violations
      .filter(
        (value) => value.impact === "serious" || value.impact === "critical",
      )
      .map((value) => value.id);
  });
  expect(violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
