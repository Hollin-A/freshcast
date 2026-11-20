import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Unscoped database access skips ADR-025's scoping, so only the places
// listed in docs/ARCHITECTURE.md ("Business isolation in the API") may have
// it. A new use fails here until it is added to both lists.

const SRC = join(import.meta.dirname, "..");

/** Files that inject the unscoped PrismaService. */
const PRISMA_SERVICE_USERS = [
  "auth/session.guard.ts", // auth bridge: the Business isn't known yet
  "database/database.module.ts", // provides it, and builds the scoped client on it
  "health/health.controller.ts", // readiness check: SELECT 1
];

/** Files that build a Prisma client of their own. */
const CLIENT_BUILDERS = ["database/prisma.service.ts"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

function filesMatching(pattern: RegExp): string[] {
  return sourceFiles(SRC)
    .filter((file) => pattern.test(readFileSync(file, "utf8")))
    .map((file) => relative(SRC, file))
    .sort();
}

describe("unscoped database access", () => {
  it("injects PrismaService only in the documented places", () => {
    expect(filesMatching(/from "[./]+(?:database\/)?prisma\.service\.js"/)).toEqual(PRISMA_SERVICE_USERS);
  });

  it("builds a Prisma client only in PrismaService", () => {
    // A value import of PrismaClient or createPrismaClient; `import type` is fine.
    const valueImport = /import\s+\{[^}]*\b(?<!type\s)(?:PrismaClient|createPrismaClient)\b[^}]*\}\s+from\s+"@freshcast\/db"/;
    expect(filesMatching(valueImport)).toEqual(CLIENT_BUILDERS);
  });
});
