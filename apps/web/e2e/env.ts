// Settings shared by the Playwright config, the global setup and the CI job.
// The App runs on the host; Chromium runs in the Playwright Docker image
// (e2e/compose.yml) so screenshots render the same on a Mac and in CI.

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/** The Playwright server in e2e/compose.yml. */
export const E2E_BROWSER_WS =
  process.env.PW_TEST_CONNECT_WS_ENDPOINT ?? "ws://127.0.0.1:3333/";

/** The throwaway Postgres in e2e/compose.yml. */
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://e2e:e2e@localhost:54329/freshcast_e2e";

/**
 * Environment for `next build` and `next start`. Values set here win over
 * apps/web/.env, so a local run never reaches the real database, Sentry,
 * Claude or email. Empty strings switch those services off.
 */
export const E2E_APP_ENV: Record<string, string> = {
  DATABASE_URL: E2E_DATABASE_URL,
  AUTH_SECRET: "e2e-only-secret",
  AUTH_URL: E2E_BASE_URL,
  NEXT_PUBLIC_SENTRY_DSN: "",
  ANTHROPIC_API_KEY: "",
  RESEND_API_KEY: "",
  CRON_SECRET: "",
  RECEIPT_UPLOAD_ENABLED: "false",
};

/** The owner the global setup seeds, matching the `onboarded` fixture. */
export const E2E_OWNER = {
  email: "owner@example.com",
  password: "e2e-password-1",
  name: "Sam Owner",
};

/** Session cookie saved by auth.setup.ts for the signed-in journeys. */
export const OWNER_STATE = "e2e/.auth/owner.json";

/** Fixtures are pinned to FIXTURE_TODAY; the browser clock is set to that evening. */
export const E2E_TIMEZONE = "Australia/Melbourne";
