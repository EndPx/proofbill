import { test, expect, type Page } from "@playwright/test";
import { prepareWallet } from "./helpers/wallet";
const owner = "wallet-entry-test.testnet";
const pass = {
  token_id: "pass-99",
  owner_id: owner,
  seller_id: "seller.testnet",
  model_id: "Qwen/Qwen3.8-27B",
  price_yocto: "10000000000000000000000",
  storage_credit_yocto: "20000000000000000000000",
  expires_at_ns: "1999999999000000000",
  authorization_revision: 0,
  agent_id: null as string | null,
  payment_mode: "Manual",
  phase: "Available",
  order_id: null,
  transfer_pending: false,
  attempt: 0,
};
async function setup(page: Page, custom = false) {
  await prepareWallet(page, true, false, true);
  const current = { ...pass, agent_id: custom ? "custom.testnet" : null };
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        path === "/api/config"
          ? {
              contractId: "proofbill.testnet",
              network: "testnet",
              configured: true,
              advancedModes: true,
              agentId: "agent.testnet",
              sellerId: "seller.testnet",
            }
          : path === "/api/workspace"
            ? { passes: [current], orders: [] }
            : path === "/api/session"
              ? { accountId: owner }
              : path.startsWith("/api/pass/")
                ? current
                : {},
    });
  });
}
async function transactions(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          proofbillTransactions?: {
            actions: {
              params: { methodName: string; args: Record<string, unknown> };
            }[];
          }[];
        }
      ).proofbillTransactions ?? [],
  );
}
test("owner selects own agent and explicitly consents to automatic payment", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/app/passes/pass-99");
  await page
    .getByRole("combobox", { name: "Purchasing agent" })
    .selectOption("custom");
  const save = page.getByRole("button", { name: "Assign my agent" });
  await expect(save).toBeDisabled();
  await page.getByLabel("Agent NEAR account").fill("custom.testnet");
  await expect(save).toBeEnabled();
  await page
    .getByRole("combobox", { name: "Payment approval" })
    .selectOption("Automatic");
  await expect(save).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.screenshot({
    path: test.info().outputPath("agent-automatic-desktop.png"),
  });
  await save.click();
  await expect.poll(async () => (await transactions(page)).length).toBe(1);
  const call = (await transactions(page))[0].actions[0].params;
  expect(call.methodName).toBe("assign_agent");
  expect(call.args).toMatchObject({
    token_id: "pass-99",
    agent_id: "custom.testnet",
    payment_mode: "Automatic",
    expected_revision: 0,
  });
  await expect(page.getByText("Current holder", { exact: true })).toBeVisible();
});
test("own agent instructions retain owner custody and can switch to ProofBill", async ({
  page,
}) => {
  await setup(page, true);
  await page.goto("/app/passes/pass-99");
  await expect(
    page.getByRole("button", { name: "Run agent", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Own-agent SDK and setup guide" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Purchasing agent" })
    .selectOption("proofbill");
  await page
    .getByRole("button", { name: "Save agent and payment settings" })
    .click();
  await expect.poll(async () => (await transactions(page)).length).toBe(1);
  expect((await transactions(page))[0].actions[0].params.args).toMatchObject({
    agent_id: "agent.testnet",
    payment_mode: "Manual",
  });
});
test("new pass defaults manual and automatic creation requires explicit consent", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/app/passes/new");
  await expect(
    page.getByRole("combobox", { name: "Payment approval" }),
  ).toHaveValue("Manual");
  await page
    .getByRole("combobox", { name: "Payment approval" })
    .selectOption("Automatic");
  const mint = page.getByRole("button", { name: "Confirm and mint pass" });
  await expect(mint).toBeDisabled();
  await page.getByRole("checkbox").check();
  await mint.click();
  await expect.poll(async () => (await transactions(page)).length).toBe(1);
  expect((await transactions(page))[0].actions[0].params).toMatchObject({
    methodName: "create_purchase_pass",
    args: { payment_mode: "Automatic" },
  });
});
test("agent and payment controls remain reachable on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await setup(page);
  await page.goto("/app/passes/pass-99");
  await page
    .getByRole("combobox", { name: "Purchasing agent" })
    .selectOption("custom");
  await page
    .getByLabel("Agent NEAR account")
    .fill("assistant.long-agent-name.testnet");
  await page
    .getByRole("combobox", { name: "Payment approval" })
    .selectOption("Automatic");
  await page.getByRole("checkbox").check();
  const save = page.getByRole("button", { name: "Assign my agent" });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeVisible();
  await expect(save).toBeEnabled();
  const checkbox = page.getByRole("checkbox");
  await expect(checkbox).toBeInViewport();
  const layout = await checkbox.evaluate((input) => {
    const label = input.closest("label")!,
      info = label.parentElement!,
      style = getComputedStyle(label);
    return {
      label: label.getBoundingClientRect().toJSON(),
      info: info.getBoundingClientRect().toJSON(),
      text: label.textContent,
      color: style.color,
      opacity: style.opacity,
      visibility: style.visibility,
    };
  });
  expect(layout.label.height).toBeGreaterThan(100);
  expect(layout.info.height).toBeGreaterThanOrEqual(layout.label.height);
  expect(layout.text).toContain("No final wallet");
  expect(layout.visibility).toBe("visible");
  await test
    .info()
    .attach("consent-layout", {
      body: JSON.stringify(layout),
      contentType: "application/json",
    });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  await page.screenshot({
    path: test.info().outputPath("agent-automatic-mobile.png"),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
