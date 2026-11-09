// End-to-end tests against the built demo fixture (plan D5). Run: npm run e2e
import { defineConfig, devices } from "@playwright/test";

// Not 4399, the default of `node test/e2e/serve.mjs` for manual review: tests must never hit a stale server.
const PORT = 4398;

export default defineConfig({
  testDir: "test/e2e",
  testMatch: "**/*.spec.mjs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}/devdigest-marketplace/`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node test/e2e/serve.mjs --fixture demo --port ${PORT}`,
    url: `http://localhost:${PORT}/devdigest-marketplace/`,
    timeout: 120_000,
    reuseExistingServer: false, // always serve a fresh build of the current code
    stdout: "pipe",
  },
});
