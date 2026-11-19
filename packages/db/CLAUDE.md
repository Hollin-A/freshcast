# packages/db: @freshcast/db

The Prisma schema, migrations, seed and `createPrismaClient()`, shared by the App and the API.

- Keep it framework-neutral, so both apps can import it: the web app adds its `server-only` guard in `apps/web/src/lib/prisma.ts`.
- Prisma commands read `packages/db/.env`.
- Change the schema through a migration (`migrate:dev`), following [CONTRIBUTING → Database schema changes](../../CONTRIBUTING.md#database-schema-changes).
- Every Business-owned model carries `businessId` with `onDelete: Cascade` from Business (ADR-008).
