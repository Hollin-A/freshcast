import { defineConfig, devices } from "@playwright/test";
import {
  E2E_APP_ENV,
  E2E_BASE_URL,
  E2E_BROWSER_WS,
  E2E_PORT,
  E2E_TIMEZONE,
  OWNER_STATE,
} from "./e2e/env";

// Journeys run against a production build of the App on the host, with
// Chromium in Docker (e2e/compose.yml). Start the services first with
// `pnpm e2e:up`. See CONTRIBUTING.md for updating screenshots.

const viewports = {
  mobile: devices["Pixel 7"],
  desktop: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
};

const journeys = (["mobile", "desktop"] as const).flatMap((size) =>
  (["light", "dark"] as const).map((appearance) => ({
    name: `${size}-${appearance}`,
    testMatch: /journeys\/.*\.spec\.ts/,
    dependencies: ["setup"],
    use: {
      ...viewports[size],
      appearance,
      colorScheme: appearance,
      storageState: OWNER_STATE,
    },
  })),
);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.results",
  // One folder per spec, no platform suffix: every run renders on Linux.
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never", outputFolder: "e2e/.report" }]] : "list",

  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001 },
  },

  use: {
    baseURL: E2E_BASE_URL,
    locale: "en-AU",
    timezoneId: E2E_TIMEZONE,
    // The App's service worker caches API responses; it would answer
    // requests before the MSW routes see them.
    serviceWorkers: "block",
    trace: "retain-on-failure",
    connectOptions: {
      wsEndpoint: E2E_BROWSER_WS,
      // Lets the browser in Docker reach the App on the host's localhost.
      exposeNetwork: "<loopback>",
    },
  },

  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    ...journeys,
  ],

  webServer: {
    // CI builds in its own step; locally, build first so the run tests
    // the current code.
    command: process.env.CI
      ? `pnpm start --port ${E2E_PORT}`
      : `pnpm build && pnpm start --port ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/login`,
    env: E2E_APP_ENV,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
