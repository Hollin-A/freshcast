# Contributing to Freshcast

Thanks for contributing. This guide keeps changes reviewable and docs consistent.

## Branching

Create a branch from `main` before starting:

```bash
git checkout main
git pull
git checkout -b feat/short-description
```

Branch naming:

- `feat/{short-description}` for features
- `fix/{short-description}` for bug fixes
- `docs/{short-description}` for docs-only changes

Use kebab-case and keep branch names short.

## Commit style

Freshcast uses conventional commits:

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `refactor: ...`
- `chore: ...`
- `style: ...`
- `test: ...`

Rules:

- Lowercase subject line
- Imperative mood (for example: "add parser fallback")
- Keep subject under 72 characters
- Group related work into one logical commit

## Pull requests

PRs should be small and focused. Include:

- What changed
- Why it changed
- How you verified it
- Any follow-up work

Recommended checklist:

- [ ] `pnpm lint`
- [ ] `pnpm exec tsc --noEmit`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Manual smoke test for affected user flow

## Documentation sync requirements

When code changes behavior, update matching docs in the same PR.

| File | Update when |
|---|---|
| `README.md` | Entrypoint-level feature list, setup, stack, or links change |
| `docs/ARCHITECTURE.md` | Architecture, services, data model, or runtime flow changes |
| `docs/API.md` | API routes, request/response contracts, or auth requirements change |
| `docs/adr/` | A significant architectural decision is made |
| `CHANGELOG.md` | User-visible shipped behavior changes |

ADR rule:

- Add a new ADR with the next sequential number for significant decisions
- Mark old ADRs as superseded when replaced

## Repository layout

This is a pnpm workspace managed with Turborepo:

- `apps/web`: the Next.js app (`@freshcast/web`). Its `.env` lives in `apps/web/.env`.
- `packages/db`: `@freshcast/db`, the Prisma schema, migrations, seed and a `createPrismaClient()` factory. It's a compiled package (`prisma generate` + `tsc` to `dist/`) shared by the apps; Turborepo builds it before anything that depends on it. Prisma commands read `packages/db/.env`. It must stay framework-neutral: no `server-only` (the web app keeps that guard in `src/lib/prisma.ts`).

Run tasks from the repo root: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck` and `pnpm test` run the task in every package through Turborepo, which caches results and skips unchanged packages. To target one package: `pnpm --filter @freshcast/web <script>`.

The web app's `build` script runs `scripts/materialize-next-aliases.mjs` after `next build`. It replaces the alias symlinks Turbopack creates in `.next/node_modules` (for `@prisma/client`, `pg`, `@aws-sdk/client-s3` and others) with real copies. Amplify deploys the app flattened to `/var/task`, which breaks those relative links, and every route using these packages would fail to load. Keep the step unless a deployment proves it unnecessary, and recheck it on Next.js upgrades.

## Package manager

This repo uses **pnpm**; the version is pinned in `package.json` (`packageManager`). Run `corepack enable` once and Corepack provides that version. Don't use npm or yarn: they ignore `pnpm-lock.yaml`.

- Dependencies whose install scripts may run are listed under `allowBuilds` in `pnpm-workspace.yaml`. If a new dependency needs its install script (for example to download a native binary), add it there deliberately.
- pnpm is strict: code can only import packages declared in its own `package.json`, so add missing dependencies explicitly instead of relying on transitive ones.
- `nodeLinker: hoisted` in `pnpm-workspace.yaml` (mirrored as `node-linker=hoisted` in `.npmrc`, which Amplify reads) keeps `node_modules` flat (npm-style). Amplify Hosting's SSR runtime can't load pnpm's default symlinked layout, so don't remove it without testing a deployment.

## Database schema changes

Schema changes go through Prisma migrations. Don't use `prisma db push` against shared databases; it changes the schema without recording a migration, and the migrations folder drifts from the real database.

1. Edit `packages/db/prisma/schema.prisma`.
2. Run `pnpm --filter @freshcast/db migrate:dev --name <short_description>` against your development database (`packages/db/.env`). It creates a migration in `packages/db/prisma/migrations/` and applies it.
   - It needs a temporary shadow database. If your database role can't create one, set `shadowDatabaseUrl` in `packages/db/prisma.config.ts` to a spare empty database, such as another Neon branch.
3. Commit the schema and the migration together.
4. Production applies migrations with `pnpm --filter @freshcast/db migrate:deploy` (with the production `DATABASE_URL` set for that command only). Applying to production is a separate, deliberate step, not part of the build.

## Next.js 16 note

This project uses Next.js 16 with breaking changes versus earlier versions.
If your change touches routing, middleware/proxy, rendering, or config conventions, verify against current Next.js 16 docs in the installed package docs.

## Merge flow

After PR approval:

```bash
git checkout main
git pull
git merge <your-branch>
```

