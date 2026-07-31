import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

/**
 * Playwright config for Enki's critical-path E2E test. Runs the production
 * build against a fresh server so the tested surface matches what ships.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // `github` alone annotates the PR but writes nothing to disk, so a failed
  // run would leave the workflow's upload-artifact step with nothing to
  // upload. `html` writes playwright-report/ on every run; `open: "never"`
  // keeps CI from trying to launch a browser to view it.
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    // Never reuse. This used to be `!process.env.CI`, so a local run silently
    // attached to whatever was already on the port. A stale server left behind
    // by an earlier session was serving a build made from mutated source, and
    // the suite reported eight failures that had nothing to do with the working
    // tree. Always building what is tested costs a rebuild; the alternative
    // costs a result that does not mean what it says. If the port is occupied,
    // startup now fails loudly instead of measuring the wrong thing.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
