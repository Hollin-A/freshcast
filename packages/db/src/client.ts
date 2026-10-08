import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

/**
 * Creates the `pg` driver adapter Prisma uses to reach Postgres. Exposed on
 * its own for the API's PrismaService, which extends PrismaClient.
 */
export function createPrismaAdapter(
  connectionString: string | undefined = process.env.DATABASE_URL
): PrismaPg {
  return new PrismaPg({ connectionString });
}

/**
 * Creates a Prisma client backed by the `pg` driver adapter.
 *
 * Callers own the instance's lifecycle: the web app keeps one per process,
 * and the API provides it through a NestJS module. This package must
 * stay framework-neutral, so it never imports `server-only` (ADR-020, #16).
 */
export function createPrismaClient(
  connectionString: string | undefined = process.env.DATABASE_URL
): PrismaClient {
  return new PrismaClient({ adapter: createPrismaAdapter(connectionString) });
}
