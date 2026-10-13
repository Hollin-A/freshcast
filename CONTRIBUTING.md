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
- `refactor/{short-description}` for restructuring without behavior change
- `chore/{short-description}` for tooling, config and maintenance
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
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Manual smoke test for affected user flow
- [ ] For changes to the build, package layout or deployment config: verified on an Amplify preview branch (see [Architecture §12.4](docs/ARCHITECTURE.md#124-preview-branches))

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
- `apps/api`: the NestJS API (`@freshcast/api`), ESM, built with the Nest CLI (`tsc`). Its `.env` lives in `apps/api/.env`; the variables are validated at startup by the Zod schema in `src/config/env.schema.ts`, so add new required config there. Relative imports use `.js` extensions (NodeNext). Controllers return their payload (or `withMeta(data, meta)`) and throw `ApiException` for expected errors; the global interceptor and filter produce the envelope. Log through Nest's `Logger`, which writes through pino. Tests are compiled with SWC (`unplugin-swc`) so Nest's dependency injection works in Vitest.
- `packages/db`: `@freshcast/db`, the Prisma schema, migrations, seed and a `createPrismaClient()` factory. It's a compiled package (`prisma generate` + `tsc` to `dist/`) shared by the apps; Turborepo builds it before anything that depends on it. Prisma commands read `packages/db/.env`. It must stay framework-neutral: no `server-only` (the web app keeps that guard in `src/lib/prisma.ts`).
- `packages/shared`: `@freshcast/shared`, the Zod request schemas, response-envelope types and the constants they use, shared by API routes, browser forms and (later) the NestJS API. Compiled with `tsc` like `@freshcast/db`. It's imported by client code, so its own lint config only allows `zod` and its own modules.

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

## Versioning and releases

Freshcast uses [semantic versioning](https://semver.org/). All workspace packages (root, `apps/web`, `packages/*`) share one version, which the health endpoint reports.

1. Changes accumulate under **Unreleased** in `CHANGELOG.md`, updated in the PR that ships them.
2. **To release:** a PR bumps every `package.json` to the new version and renames "Unreleased" to `vX.Y.Z — <date> — <title>` (with a fresh empty "Unreleased" above it).
3. **After it merges,** tag the merge commit `vX.Y.Z` on `main` and publish a GitHub Release, using the CHANGELOG section as its notes.

## Next.js 16 note

This project uses Next.js 16 with breaking changes versus earlier versions.
If your change touches routing, middleware/proxy, rendering, or config conventions, verify against current Next.js 16 docs in the installed package docs.

## Merge flow

`main` is protected: changes land through pull requests, and the CI `check` job (lint, type check, tests, build) must pass before merging. Merge on GitHub, then update your local copy:

```bash
git checkout main
git pull
git branch -d <your-branch>
```

Merges to `main` deploy to production through AWS Amplify (see [Architecture §12](docs/ARCHITECTURE.md#12-build-and-deployment)).

