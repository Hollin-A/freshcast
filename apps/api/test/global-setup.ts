import { execFileSync } from "node:child_process";
import path from "node:path";
import { assertLocalDatabase, E2E_DATABASE_URL } from "./env.js";

// Applies the migrations to the throwaway database once per run, the same
// way deploys do (`prisma migrate deploy`), so the tests run against the
// production schema rather than one pushed from schema.prisma.
export default function globalSetup(): void {
  assertLocalDatabase(E2E_DATABASE_URL);
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: path.resolve(import.meta.dirname, "../../../packages/db"),
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: "inherit",
  });
}
