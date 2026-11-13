import type { Page } from "@playwright/test";
// This injected wallet exercises connector events without keys, signatures or chain writes.
export async function prepareWallet(
  page: Page,
  restored = false,
  rejectOnce = false,
  allowTransactions = false,
) {
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
    ({ restored, rejectOnce, allowTransactions }) => {
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
              async signAndSendTransaction(transaction: unknown) {
                if (allowTransactions) {
                  const host = window as unknown as {
                    proofbillTransactions: unknown[];
                  };
                  (host.proofbillTransactions ??= []).push(transaction);
                  return {
                    transaction: { hash: "BrowserFixtureNoChainWrite" },
                  };
                }
                throw new Error("Transactions are forbidden in this test");
              },
            },
          }),
        );
      });
    },
    { restored, rejectOnce, allowTransactions },
  );
}
