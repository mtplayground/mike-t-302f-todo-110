import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";

if (!process.env.E2E_BASE_URL && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run Playwright against local dev servers");
}

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: "list",
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: "npm run dev:server",
          env: {
            ...process.env,
            HOST: "0.0.0.0",
            NODE_ENV: "test",
            PORT: "8080",
          },
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: "http://127.0.0.1:8080/health",
        },
        {
          command: "npm run dev:client",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: baseURL,
        },
      ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
