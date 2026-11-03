import { execFileSync } from "node:child_process";
import path from "node:path";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "@freshcast/db";
import { onboarded } from "../src/test/msw/fixtures/onboarded";
import { E2E_DATABASE_URL, E2E_OWNER, E2E_TIMEZONE } from "./env";

// Migrates the throwaway database and seeds the one owner the journeys log in
// as. Server components read only the session and this business; everything
// the browser fetches comes from the MSW handlers, so the business name and
// type are taken from the `onboarded` fixture to keep the two in step.
export default async function globalSetup() {
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: path.resolve(import.meta.dirname, "../../../packages/db"),
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: "inherit",
  });

  const prisma = createPrismaClient(E2E_DATABASE_URL);
  try {
    const passwordHash = await bcrypt.hash(E2E_OWNER.password, 10);
    const business = {
      name: onboarded.business.name,
      type: onboarded.business.type,
      timezone: E2E_TIMEZONE,
      onboarded: true,
    };
    await prisma.user.upsert({
      where: { email: E2E_OWNER.email },
      update: { name: E2E_OWNER.name, passwordHash, business: { update: business } },
      create: {
        email: E2E_OWNER.email,
        name: E2E_OWNER.name,
        passwordHash,
        emailVerified: new Date(),
        business: { create: business },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
