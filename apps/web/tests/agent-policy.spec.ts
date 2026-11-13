import { test, expect, type Page } from "@playwright/test";
import { prepareWallet } from "./helpers/wallet";
import type { OrderPhase, PaymentMode } from "@proofbill/shared";
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
async function setup(page: Page, custom = false, budgetPasses = false) {
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
              budgetPasses,
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
test("budget funding uses exact amounts and a changed cap requires renewed automatic consent", async ({ page }) => {
  await page.setViewportSize({width:360,height:800});
  await setup(page,false,true);
  await page.goto("/app/passes/new");
  const input=page.getByRole("textbox",{name:"Service budget (testnet NEAR)"});
  const mint=page.getByRole("button",{name:"Confirm and mint pass"});
  await expect(input).toHaveValue("0.050");
  await expect(page.getByText("5 purchases at 0.010 NEAR each. Storage is separate.")).toBeVisible();
  await input.fill("0.015");
  await expect(input).toHaveAttribute("aria-invalid","true");
  await expect(mint).toBeDisabled();
  await input.fill("0.030");
  await page.getByRole("combobox",{name:"Payment approval"}).selectOption("Automatic");
  await page.getByRole("checkbox").check();
  await input.fill("0.040");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(mint).toBeDisabled();
  await expect(page.getByText(/remaining service budget of 0.040/)).toBeVisible();
  await page.getByRole("checkbox").check();
  await mint.scrollIntoViewIfNeeded();
  await page.screenshot({path:test.info().outputPath("budget-funding-mobile.png")});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await mint.click();
  await expect.poll(async ()=>(await transactions(page)).length).toBe(1);
  const sent=(await transactions(page))[0].actions[0].params as {methodName:string;args:Record<string,unknown>;deposit:string};
  expect(sent.methodName).toBe("create_budget_pass");
  expect(sent.args.budget_yocto).toBe("40000000000000000000000");
  expect(sent.deposit).toBe("110000000000000000000000");
});
test("remaining budget refund explains closure and prior public receipts stay reachable", async ({ page }) => {
  await setup(page,false,true);
  await page.route("**/api/pass/**", r=>r.fulfill({json:{...pass,budget:{
    funded_yocto:"30000000000000000000000",available_yocto:"10000000000000000000000",
    reserved_yocto:"0",spent_yocto:"20000000000000000000000",refunded_yocto:"0",orders_created:2,
  }}}));
  await page.goto("/app/passes/pass-99");
  await expect(page.getByText(/Refund returns 0.010 testnet NEAR and closes this budget pass/)).toBeVisible();
  await expect(page.getByRole("link",{name:"Order 1 receipt"})).toHaveAttribute("href","/receipts/pass-99-order-1");
  await expect(page.getByRole("link",{name:"Order 2 receipt"})).toHaveAttribute("href","/receipts/pass-99-order-2");
});
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
test("order copy identifies the actual agent and follows payment mode and outcome", async ({ page }) => {
  await setup(page);
  let phase: OrderPhase = "Reserved";
  let mode: PaymentMode = "Automatic";
  await page.route("**/api/order/**", (route) => route.fulfill({ json: {
    order: {
      order_id: "pass-99-order", token_id: "pass-99", buyer_id: owner,
      agent_id: "custom.testnet", seller_id: "seller.testnet", price_yocto: pass.price_yocto,
      revision: 0, phase, attempt: ["Paid", "PaymentPending", "TransferFailed"].includes(phase) ? 1 : 0,
      response_commitment: phase === "Reserved" || phase === "Refunded" ? null : "response",
      evidence_commitment: "evidence", request_commitment: "request", policy_id: "policy",
      created_at_ns: "1794610000000000000",
    }, payment_mode: mode, job: null, observations: [],
  } }));
  const visit = () => page.goto("/app/orders/pass-99-order");
  await visit();
  await expect(page.getByText("pass-99-order · Agent: custom.testnet", { exact: true })).toBeVisible();
  await expect(page.getByText(/advance authorization starts the initial seller payment/)).toBeVisible();
  await expect(page.getByText("Automatic payment authorized in advance", { exact: true })).toBeVisible();
  await expect(page.getByText("Buyer payment approval", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve payment" })).toHaveCount(0);
  phase = "PaymentPending";
  await visit();
  await expect(page.getByText(/Paid appears only after the contract confirms success/)).toBeVisible();
  phase = "TransferFailed";
  await visit();
  await expect(page.getByText(/buyer can approve a retry or request a service refund/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry failed payment" })).toBeVisible();
  phase = "Delivered";
  mode = "Manual";
  await visit();
  await expect(page.getByText("Buyer payment approval", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve payment" })).toBeVisible();
  phase = "Refunded";
  await visit();
  await expect(page.getByText(/confirmed the service refund to the buyer/)).toBeVisible();
  await expect(page.getByText("Result delivered", { exact: true }).locator("..")).not.toHaveClass(/done/);
  await expect(page.getByRole("button", { name: "Approve payment" })).toHaveCount(0);
});
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
