// Loads DATABASE_URL from packages/db/.env. Prisma commands run with this
// package as the working directory (e.g. `pnpm --filter @freshcast/db migrate:deploy`).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
