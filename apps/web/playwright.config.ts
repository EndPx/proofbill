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
    : {
        command: "pnpm build && pnpm start --port 3215",
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
