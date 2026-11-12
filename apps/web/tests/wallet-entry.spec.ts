import { test, expect, type Page } from "@playwright/test";

// This injected wallet exercises connector events without keys, signatures or chain writes.
async function prepareWallet(page: Page, restored = false, rejectOnce = false) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === "/api/config"
        ? {
            contractId: "proofbill-endpx-2026.testnet",
            network: "testnet",
            configured: true,
            agentId: "agent.testnet",
          }
        : path === "/api/workspace"
          ? { passes: [], orders: [] }
          : path === "/api/session"
            ? { accountId: null }
            : {};
    await route.fulfill({ json: body });
  });
  await page.route("**/repository/manifest.json", (route) =>
    route.fulfill({ json: { wallets: [], version: "1.0.0" } }),
  );
  await page.addInitScript(
    ({ restored, rejectOnce }) => {
      if (restored && !sessionStorage.getItem("test-wallet-initialized")) {
        localStorage.setItem("selected-wallet", "proofbill-test-wallet");
        localStorage.setItem("test-wallet-connected", "true");
        sessionStorage.setItem("test-wallet-initialized", "true");
      }
      let reject = rejectOnce;
      const accounts = [
        {
          accountId: "wallet-entry-test.testnet",
          publicKey: "ed25519:11111111111111111111111111111111",
        },
      ];
      window.addEventListener("near-selector-ready", () => {
        window.dispatchEvent(
          new CustomEvent("near-wallet-injected", {
            detail: {
              manifest: {
                id: "proofbill-test-wallet",
                name: "ProofBill test wallet",
                type: "injected",
                description: "Browser test fixture",
                website: "https://example.com",
                icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
                features: {
                  testnet: true,
                  signMessage: true,
                  signAndSendTransaction: true,
                },
                networks: ["testnet"],
              },
              async signIn() {
                if (reject) {
                  reject = false;
                  throw new Error("User rejected");
                }
                localStorage.setItem("test-wallet-connected", "true");
                return accounts;
              },
              async getAccounts() {
                return localStorage.getItem("test-wallet-connected") === "true"
                  ? accounts
                  : [];
              },
              async signOut() {
                localStorage.removeItem("test-wallet-connected");
              },
              async signMessage() {
                throw new Error("Signing is outside this connection test");
              },
              async signAndSendTransaction() {
                throw new Error("Transactions are forbidden in this test");
              },
            },
          }),
        );
      });
    },
    { restored, rejectOnce },
  );
}

test("every app entry waits for a wallet without mounting the workspace", async ({
  page,
}) => {
  await prepareWallet(page);
  const workspaceRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(workspace|pass\/|order\/|private\/)/.test(request.url()))
      workspaceRequests.push(request.url());
  });
  for (const path of [
    "/app",
    "/app/purchases",
    "/app/passes/new",
    "/app/receipts/pass-2-order",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Connect to continue" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect wallet", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".app-shell")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(path.replaceAll("/", "\\/") + "$"));
  }
  expect(workspaceRequests).toEqual([]);
});

test("cancelled connection can be retried and resumes the original destination", async ({
  page,
}) => {
  await prepareWallet(page, false, true);
  const authRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/")) authRequests.push(request.url());
  });
  await page.goto("/app/passes/new");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByText("ProofBill test wallet", { exact: true }).click();
  await expect(page.locator(".wallet-entry-error")).toContainText(
    "Your wallet is not connected",
  );
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByText("ProofBill test wallet", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "New Purchase Pass" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/app\/passes\/new$/);
  await expect(
    page.getByRole("button", { name: "Unlock private session" }),
  ).toBeVisible();
  expect(authRequests).toEqual([]);
});

test("restored connection survives refresh and disconnect closes the workspace", async ({
  page,
}) => {
  await prepareWallet(page, true);
  await page.goto("/app/purchases");
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Account wallet-entry-test.testnet; disconnect",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Connect to continue" }),
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".app-shell")).toHaveCount(0);
});

test("wallet entry fits narrow screens and has a route back home", async ({
  page,
}) => {
  await prepareWallet(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/purchases");
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".wallet-entry")).toHaveCount(0);
});
