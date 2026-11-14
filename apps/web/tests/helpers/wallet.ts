import type { Page } from "@playwright/test";
// This injected wallet exercises connector events without keys, signatures or chain writes.
export async function prepareWallet(
  page: Page,
  restored = false,
  rejectOnce = false,
  allowTransactions = false,
  messageBehavior: "reject" | "approve" | "reject-once" | "wrong-account" | "pending" = "reject",
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
            : path === "/api/auth/challenge"
              ? { id: "browser-fixture", message: "Sign in to ProofBill. Challenge: browser-fixture", recipient: "localhost:3215", nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" }
            : {};
    await route.fulfill({ json: body });
  });
  await page.route("**/repository/manifest.json", (route) =>
    route.fulfill({ json: { wallets: [], version: "1.0.0" } }),
  );
  await page.addInitScript(
    ({ restored, rejectOnce, allowTransactions, messageBehavior }) => {
      if (restored && !sessionStorage.getItem("test-wallet-initialized")) {
        localStorage.setItem("selected-wallet", "proofbill-test-wallet");
        localStorage.setItem("test-wallet-connected", "true");
        sessionStorage.setItem("test-wallet-initialized", "true");
      }
      let reject = rejectOnce;
      let rejectMessage = messageBehavior === "reject-once";
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
              async signMessage(payload: unknown) {
                const host = window as unknown as {
                  proofbillMessages: unknown[];
                  proofbillResolveMessage?: () => void;
                };
                (host.proofbillMessages ??= []).push(payload);
                if (messageBehavior === "reject" || rejectMessage) {
                  rejectMessage = false;
                  throw new Error("User rejected message");
                }
                if (messageBehavior === "pending")
                  await new Promise<void>(resolve => { host.proofbillResolveMessage = resolve; });
                return {
                  accountId: messageBehavior === "wrong-account" ? "other.testnet" : accounts[0].accountId,
                  publicKey: accounts[0].publicKey,
                  signature: "BrowserFixtureNotACryptographicSignature",
                };
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
    { restored, rejectOnce, allowTransactions, messageBehavior },
  );
}
