import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ path: ".env.test" });

if (!process.env.DATABASE_URL?.includes("_test")) {
  throw new Error(
    "E2E tests require DATABASE_URL to point at a database whose name " +
      'contains "_test" — refusing to run against a non-test database.',
  );
}

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // This sandbox pre-installs a Chrome build under a fixed path
        // rather than the exact revision this pinned @playwright/test
        // version would otherwise try to download. CI and normal
        // developer machines don't set this and use Playwright's own
        // managed browser instead (see docs/testing.md).
        launchOptions: process.env.PLAYWRIGHT_BROWSERS_PATH
          ? { executablePath: "/opt/pw-browsers/chromium" }
          : {},
      },
    },
  ],
  webServer: {
    // Runs against the dev server (fast iteration for this phase); the
    // separate `npm run build` quality gate covers production-build
    // correctness (docs/testing.md).
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-test-secret",
    },
  },
});
