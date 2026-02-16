import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright/tests",
  timeout: 60 * 1000,
  expect: {
    timeout: 5000,
  },
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",
    storageState: "playwright/.auth-state.json",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    stderr: "pipe",
    stdout: "pipe",
    timeout: 60_000,
  },
});

