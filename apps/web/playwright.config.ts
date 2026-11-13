import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3215";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: "node tests/fixtures/receipt-rpc.mjs",
          url: "http://127.0.0.1:43216/health",
          reuseExistingServer: false,
        },
        {
          env: {
            APP_ORIGIN: baseURL,
            NEAR_AGENT_ID: "agent.testnet",
            NEXT_PUBLIC_NEAR_AGENT_ID: "agent.testnet",
            NEAR_RPC_URL: "http://127.0.0.1:43216",
            NEAR_CONTRACT_ID: "proofbill-fixture.testnet",
            NEXT_PUBLIC_NEAR_CONTRACT_ID: "proofbill-fixture.testnet",
            DATABASE_URL: "",
            ARTIFACT_ENCRYPTION_KEY: "",
            NEAR_AGENT_KEY: "",
            NEAR_PUBLISHER_KEY: "",
            NEAR_AI_CLOUD_API_KEY: "",
          },
          command: "pnpm build && pnpm start --port 3215",
          url: baseURL,
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
        },
      ],
});
