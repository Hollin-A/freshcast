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
- `ui/{short-description}` for frontend presentation-only changes

Use kebab-case and keep branch names short.

### UI-only branches

A `ui/` branch may only change the frontend presentation files listed in [`.github/ui-paths`](.github/ui-paths): styles, components, pages and layouts, copy and static assets, plus the tests that ship with them: component tests (`*.test.tsx`), stories (`*.stories.tsx`), Playwright journeys (`apps/web/e2e/journeys/`) and their screenshot baselines. Test config, the MSW handlers and Playwright's setup files stay out, so a UI change can't alter what the tests run against. Route handlers, `services/`, `lib/`, `proxy.ts`, the service worker, `apps/api`, `packages/*`, dependencies and config are out of scope, so UI work can't reach the backend while the migration is in progress. Commits still use the usual types, such as `feat(web):`, `fix(web):` or `style(web):`.

On top of the path list, the guard rejects a `ui/` change that:

- adds a server action (a `"use server"` directive), a route handler (`route.*`) or an `actions.*` file
- adds, removes or edits a line in an allowed file that imports or calls `@/lib/auth`, `@/lib/prisma` or `@/lib/s3`, reads `session`, or calls `redirect(`. Pages and layouts in `(app)` still load their own data, so these lines are how a UI change could reach the backend. The check works line by line: it catches imports, calls and the auth gate, not every line of a multi-line query.
- adds scripts to `public/` or changes `sw-register.tsx`, since a service worker controls caching of API responses
- touches the guard itself (`.github/`, `scripts/`, `.claude/`), whatever `.github/ui-paths` says

The guard runs in three places, all through `scripts/check-ui-scope.mjs`:

- **Claude Code:** a `PreToolUse` hook in `.claude/settings.json` blocks edits outside the scope on `ui/` branches. It fails closed: if the hook itself errors, the edit is blocked. It resolves symlinks, and blocks edits that land in another checkout of the repo; files outside every checkout (scratch space, memory) are allowed. It does nothing on other branches, and it can't see shell commands.
- **CI, `scope-guard` (`ci.yml`):** fails a `ui/` pull request that goes outside the scope, including through shell commands the hook can't see. It runs `main`'s copy of the script, which reads `main`'s `.github/ui-paths`, so a `ui/` branch can't loosen the rules that judge it.
- **CI, `scope-guard-main` (`scope-guard.yml`):** the same check through `pull_request_target`, so it runs the workflow as it is on `main` even if a pull request edits `ci.yml`. It never checks out or runs the pull request's code; it only reads file names, diffs and contents through git.

Run it locally with `node scripts/check-ui-scope.mjs`, and its tests with `node --test scripts/check-ui-scope.test.mjs`. If a UI change turns out to need anything outside the scope, it isn't UI-only: rename the branch to `feat/` or `fix/`. Widen `.github/ui-paths` through its own PR, not from a `ui/` branch. `.github/CODEOWNERS` assigns the guard's files to the owner.

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

PRs should be small and focused. The body follows [`.github/pull_request_template.md`](.github/pull_request_template.md), the template of the `mattpocock-skills:pr` skill:

- **Summary**: the smallest view that makes the change clear (a diagram, diff sketch, call tree or pseudocode)
- **Evidence**: before and after for each claim (a screenshot, command output or test run)
- **Merge Danger**: **Door** (one-way or two-way) and **Blast Radius** (one word)

The `PR body` workflow fails a PR whose body is missing a section, leaves one empty, or gives a Door other than one-way or two-way. It runs again when you edit the description. In Claude Code, a `PreToolUse` hook (`scripts/check-pr-body.mjs`) blocks `gh pr create` and `gh pr edit --body` until the session has loaded the skill, and also blocks if it can't read the session transcript. The project settings enable the `mattpocock-skills` plugin so the skill is available.

Recommended checklist:

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Manual smoke test for affected user flow
- [ ] For changes to the build, package layout or deployment config: verified on an Amplify preview branch (see [Architecture §11.4](docs/ARCHITECTURE.md#114-preview-branches))

## Documentation sync requirements

When code changes behavior, update matching docs in the same PR.

| File | Update when |
|---|---|
| `README.md` | Entrypoint-level feature list, setup, stack, or links change |
| `docs/ARCHITECTURE.md` | Architecture, services, data model, or runtime flow changes |
| `docs/API.md` | API routes, request/response contracts, or auth requirements change |
| `docs/adr/` | A significant architectural decision is made |
| `CHANGELOG.md` | User-visible shipped behavior changes |
| `GLOSSARY.md` | A domain term is added, renamed or sharpened |
| `docs/TESTING.md` | Test tooling, fixtures or how a kind of test is written changes |
| `CLAUDE.md` (root or package) | A workflow rule or a package convention changes |

ADR rule:

- Add a new ADR with the next sequential number for significant decisions
- Mark old ADRs as superseded when replaced

## Workspace

This is a pnpm workspace built with Turborepo; [Architecture §2.2](docs/ARCHITECTURE.md#22-project-structure) shows the layout, and each package's `CLAUDE.md` holds its conventions.

Run tasks from the repo root: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck` and `pnpm test` run the task in every package through Turborepo, which caches results and skips unchanged packages. To target one package: `pnpm --filter @freshcast/web <script>`.

The `infra` package holds the API's AWS infrastructure as CDK code. See [Infrastructure](#infrastructure-aws-cdk) below.

### API image

The API's production image is built from the repo root ([Architecture §12.4](docs/ARCHITECTURE.md#124-api-image)). To build it and run it against the e2e Postgres:

```bash
docker build -f apps/api/Dockerfile -t freshcast-api .
pnpm --filter @freshcast/api e2e:up
docker run --rm -p 4000:4000 \
  -e DATABASE_URL=postgresql://e2e:e2e@host.docker.internal:54330/freshcast_api_e2e \
  -e AUTH_SECRET=<at least 32 characters> \
  freshcast-api
curl localhost:4000/health/ready
```

CI's `api-image` job does the same on every pull request that touches the API.

## Testing

[docs/TESTING.md](docs/TESTING.md) covers every kind of test: unit and component tests, stories, Playwright journeys and screenshot baselines, the API's e2e tests, and the infrastructure tests.

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

## Infrastructure (AWS CDK)

The API's AWS resources are defined in `infra/` and change only through pull requests ([Architecture §12](docs/ARCHITECTURE.md#12-infrastructure)). Don't create or edit them in the console.

### AWS access on your machine

Use IAM Identity Center (AWS's single sign-on) with a `freshcast` CLI profile. Don't use the root user or long-lived access keys.

```bash
aws configure sso                      # once: start URL, ap-southeast-2, AdministratorAccess, profile "freshcast"
aws sso login --profile freshcast      # when the session expires
aws sts get-caller-identity --profile freshcast
```

### Day to day

```bash
pnpm --filter @freshcast/infra test                              # template assertions, no AWS calls
pnpm synth                                                       # CloudFormation templates in infra/cdk.out
pnpm --filter @freshcast/infra diff --profile freshcast          # compare with what is deployed
```

- **CI:** a pull request that touches `infra/`, `packages/*`, dependencies, Turborepo or CI config, or any file outside the known areas, runs `cdk synth` and shows the same diff in its `infra-diff` job (log and job summary). Read it before you merge. Pull requests from forks skip the job, because GitHub gives them no OIDC token.
- **New lookups:** if a change adds a lookup (`fromLookup`), run `pnpm --filter @freshcast/infra synth --profile freshcast` once and commit the updated `infra/cdk.context.json`. CI synthesizes before it signs in to AWS, so a missing entry fails the job.
- **Validation:** cdk-nag and CDK's CloudFormation validation fail synth on any violation. Fix the finding, or acknowledge it on the construct it applies to with `Validations.of(construct).acknowledge({ id, reason })`.
- **Deploys:** a push to `main` that changes the API, `packages/*`, `infra/`, dependencies or `ci.yml` deploys `FreshcastApi` through CI's `deploy-api` job ([Architecture §12.3](docs/ARCHITECTURE.md#123-ci-access)). It pushes the image, tags it `production-<sha>`, runs `cdk deploy FreshcastApi`, and fails unless `/health/live` reports the new commit and `/health/ready` returns 200. To redeploy a commit, re-run the job.
- **Stacks deployed by hand:** CI never deploys `FreshcastAccount` (it holds the roles CI signs in with) or `FreshcastShared` (the image repository). After a pull request that changes them merges, deploy them by hand, and only with the owner's go-ahead.
- **Database migrations** are not part of the deploy. Apply an additive migration by hand before the code that needs it merges, and remove old columns in a later change (expand → switch → delete), because the Legacy API and the API share the database.
- **Deploying the API by hand** (break-glass, when CI can't): tag the image `production-<sha>` first. The ECR lifecycle rule protects only images with that tag, so an image without it expires after 10 more pushes, and ECS then can't start a replacement task.
  ```bash
  sha=<git-sha>
  get() { aws ecr batch-get-image --repository-name freshcast-api --image-ids imageTag=$sha --query "images[0].$1" --output text --profile freshcast --region ap-southeast-2; }
  aws ecr put-image --repository-name freshcast-api --image-tag production-$sha --image-manifest "$(get imageManifest)" --image-manifest-media-type "$(get imageManifestMediaType)" --profile freshcast --region ap-southeast-2
  pnpm --filter @freshcast/infra cdk deploy FreshcastShared --profile freshcast
  pnpm --filter @freshcast/infra cdk deploy FreshcastApi --parameters ImageTag=$sha --profile freshcast
  ```
  `ImageTag` must name an image that is already in the `freshcast-api` repository. Later deploys of `FreshcastApi` without `--parameters` keep the image that runs.
- **Changed secret values:** ECS reads secrets only when a task starts, and `cdk deploy` with an unchanged template starts none. After changing a secret's value, start new tasks (the names are the `FreshcastApi` stack's `ClusterName` and `ServiceName` outputs):
  ```bash
  aws ecs update-service --cluster <ClusterName> --service <ServiceName> --force-new-deployment --profile freshcast --region ap-southeast-2
  ```
  Recreating a secret changes its suffix instead: update `config.apiEnvironments` and deploy.

### One-time setup (already done once per account)

1. Bootstrap CDK for the account and AWS Region, then turn on termination protection for the `CDKToolkit` stack:
   ```bash
   pnpm --filter @freshcast/infra cdk bootstrap aws://<account-id>/ap-southeast-2 --profile freshcast
   aws cloudformation update-termination-protection --enable-termination-protection --stack-name CDKToolkit --profile freshcast --region ap-southeast-2
   ```
2. Store the budget alert address, which stays out of the public repo:
   ```bash
   aws ssm put-parameter --name /freshcast/budget-alert-email --type String --value <email> --profile freshcast --region ap-southeast-2
   ```
3. Put the account ID in `infra/cdk.json` (`"freshcast:awsAccountId"` under `context`), run `pnpm --filter @freshcast/infra synth --profile freshcast` to cache the hosted zone lookup, and commit both `cdk.json` and `cdk.context.json`.
4. Deploy the account stack. CI can't create the role it signs in with, so this first deploy is done by hand:
   ```bash
   pnpm --filter @freshcast/infra cdk deploy FreshcastAccount --profile freshcast
   ```
5. Set the stack's outputs as repository variables in GitHub (Settings → Secrets and variables → Actions → Variables): `CdkDiffRoleArn` as `AWS_CDK_DIFF_ROLE_ARN`, and `ApiDeployRoleArn` as `AWS_DEPLOY_ROLE_ARN`. The `deploy-api` job is skipped while `AWS_DEPLOY_ROLE_ARN` is unset.
6. Create the `production` environment in GitHub (Settings → Environments) and set its deployment branches to `main` only. The deploy role trusts only tokens for that environment, so this rule is what keeps other branches from deploying.
7. Create the API's secrets in Secrets Manager, as plain strings with no trailing newline. CDK never creates them, and references each by its complete ARN ([Architecture §12.5](docs/ARCHITECTURE.md#125-api-service)):
   - `freshcast/database-url`: the production Neon pooled connection string, ending in `?sslmode=require` (read by ECS at task start)
   - `freshcast/auth-secret`: the same value as the App's `AUTH_SECRET` (read by ECS at task start)
   - `freshcast/anthropic-api-key`: the Claude API key (read by the API itself)
   ```bash
   f=$(mktemp); read -rs "v?Value: "; echo; printf '%s' "$v" > "$f"; unset v   # zsh; paste the value at the prompt
   aws secretsmanager create-secret --name <name> --secret-string "file://$f" --tags Key=project,Value=freshcast --profile freshcast --region ap-southeast-2
   rm -P "$f"
   ```
   Then put each secret's name with its suffix (the end of its ARN, for example `freshcast/auth-secret-pZBxRx`) in `config.apiEnvironments` in `infra/lib/config.ts`: the first two under `secrets.startup`, the API key under `secrets.runtime`. A bare name doesn't work: Secrets Manager would read its last hyphen and 6 characters as a suffix.

## Versioning and releases

Freshcast uses [semantic versioning](https://semver.org/). All workspace packages (root, `apps/*`, `packages/*`, `infra`) share one version, which the health endpoint reports.

1. Changes accumulate under **Unreleased** in `CHANGELOG.md`, updated in the PR that ships them.
2. **To release:** a PR bumps every `package.json` to the new version and renames "Unreleased" to `vX.Y.Z — <date> — <title>` (with a fresh empty "Unreleased" above it).
3. **After it merges,** tag the merge commit `vX.Y.Z` on `main` and publish a GitHub Release, using the CHANGELOG section as its notes.

## Merge flow

`main` is protected: changes land through pull requests, and the required CI checks must pass before merging (see [Architecture §11.2](docs/ARCHITECTURE.md#112-ci-and-branch-rules)). Jobs whose area a pull request doesn't change are skipped, which counts as passing. Merge on GitHub, then update your local copy:

```bash
git checkout main
git pull
git branch -d <your-branch>
```

Merges to `main` deploy to production through AWS Amplify (see [Architecture §11](docs/ARCHITECTURE.md#11-build-and-deployment)).

