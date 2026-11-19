// Settings shared by the e2e config, the global setup and the CI job.

/** The database in test/compose.yml. The guards below accept no other name. */
export const E2E_DATABASE_NAME = "freshcast_api_e2e";

/** The throwaway Postgres in test/compose.yml. */
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://e2e:e2e@localhost:54330/freshcast_api_e2e";

/** Signs the session cookies the tests make (see sessionCookie in harness.ts). */
export const E2E_AUTH_SECRET = "e2e-only-secret-at-least-32-characters";

/**
 * Environment for the app under test. setup-env.ts copies it into
 * process.env, which wins over apps/api/.env, so a local run never reaches
 * the real database.
 */
export const E2E_APP_ENV: Record<string, string> = {
  NODE_ENV: "test",
  DATABASE_URL: E2E_DATABASE_URL,
  AUTH_SECRET: E2E_AUTH_SECRET,
};

/**
 * The tests empty every table, so refuse to run against anything but the
 * e2e database on localhost. A local dev database on another name doesn't
 * pass, even when E2E_DATABASE_URL points at it.
 */
export function assertLocalDatabase(url: string): void {
  const { hostname, pathname } = new URL(url);
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) {
    throw new Error(`e2e tests empty the database, so they only run against localhost (got ${hostname})`);
  }
  const name = decodeURIComponent(pathname.slice(1));
  if (name !== E2E_DATABASE_NAME) {
    throw new Error(`e2e tests empty the database, so they only run against ${E2E_DATABASE_NAME} (got ${name || "none"})`);
  }
}
