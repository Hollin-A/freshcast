import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

/**
 * Creates a Prisma client backed by the `pg` driver adapter.
 *
 * Callers own the instance's lifecycle: the web app keeps one per process,
 * and the API will provide it through a NestJS module. This package must
 * stay framework-neutral, so it never imports `server-only` (ADR-020, #16).
 */
export function createPrismaClient(
  connectionString: string | undefined = process.env.DATABASE_URL
): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
