// Server-only guard stays in the web app; @freshcast/db is framework-neutral.
import "server-only";
import { createPrismaClient, type PrismaClient } from "@freshcast/db";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
