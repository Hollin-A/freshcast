# Testing

How Freshcast is tested, and how to write and run each kind of test.

| Kind | Where | Run |
|---|---|---|
| Unit (web) | `apps/web/src/**/*.test.ts` | `pnpm test` |
| Component (web) | `apps/web/src/**/*.test.tsx` | `pnpm test` |
| Stories | `apps/web/src/**/*.stories.tsx` | `pnpm test:storybook` |
| Playwright journeys | `apps/web/e2e/` | `pnpm --filter @freshcast/web test:e2e` |
| Unit (API) | `apps/api/src/**/*.test.ts` | `pnpm test` |
| API e2e | `apps/api/test/*.e2e-spec.ts` | `pnpm --filter @freshcast/api test:e2e` |
| Guard scripts | `scripts/*.test.mjs` | `node --test scripts/<name>.test.mjs` |

`pnpm test` runs every package's unit and component tests through Turborepo. Unit tests are pure: no database or network calls.

## Component tests (web)

Vitest runs two projects in `apps/web`: `unit` (`*.test.ts`, Node) and `component` (`*.test.tsx`, jsdom with React Testing Library).

- Render components with `renderWithProviders` from `src/test/render.tsx`, which supplies next-intl messages and a fresh TanStack Query client.
- Query by role, label or text, so restyling doesn't break tests.
- Component tests talk to the Legacy API through MSW handlers in `src/test/msw/`. `createHandlers(scenario)` mocks every endpoint the App calls, from the `onboarded` (default) or `empty` fixtures, and a request with no handler fails the test.
- Override one endpoint with `server.use(http.get(...))` and build its response with `ok()` or `fail()` from `src/test/msw/envelope.ts`.
- When a component calls a new endpoint, add its handler there. When a domain moves to the API (ADR-023), switch its handlers to the new contract in the same change.
- Mock `next/navigation` with `vi.mock` where a component reads the route.
- Async Server Components can't be rendered in Vitest; cover them with the Playwright journeys.

## Stories

Stories (`*.stories.tsx`, beside the component) catalogue the components in `components/ui` and `components/shared`, using CSF Next: `preview.meta()` and `meta.story()` from `#.storybook/preview`.

- The preview supplies the same providers, a signed-in session and the MSW handlers. Override an endpoint in a story's `beforeEach` with `msw.use(...)`, and set the route with `parameters.nextjs.navigation`.
- Add a `play` function for behaviour worth checking, querying by role or label as in component tests.
- `pnpm --filter @freshcast/web storybook` opens Storybook at http://localhost:6006.
- `pnpm test:storybook` runs every story in headless Chromium, once per Appearance. It needs Chromium once: `pnpm --filter @freshcast/web exec playwright install chromium`.
- Accessibility checks report violations without failing the run until the new Brand lands (#98).

## Playwright journeys (web)

Journeys live in `apps/web/e2e/`: log in, log a sale, the dashboard and history, each at a mobile and a desktop viewport in the light and dark Appearance, each compared with a committed screenshot.

They run against a production build of the App with real Auth.js and a throwaway Postgres; the setup project logs in once and saves the session. Server components read only the session and the seeded Business, and every other `/api` call the browser makes is answered by the same MSW handlers as the component tests (through `@msw/playwright`), with the browser clock pinned to the fixture date. An API call without a handler fails the test. Chromium runs in Playwright's Docker image so screenshots render the same on a Mac and in CI.

```bash
pnpm --filter @freshcast/web e2e:up      # Postgres and the Playwright browser (Docker)
pnpm --filter @freshcast/web test:e2e    # builds the App, then runs the journeys
pnpm --filter @freshcast/web e2e:down
```

The run builds with the values in `e2e/env.ts`, which override `apps/web/.env`, so it never reaches the real database, Sentry, Claude or email.

### Updating screenshot baselines

Baselines are in `apps/web/e2e/__screenshots__/`, one per page, project and Appearance. When a change alters a page on purpose, regenerate them and commit the images with the change:

```bash
pnpm --filter @freshcast/web test:e2e:update
```

- Generate baselines only with the Docker browser from `e2e:up`; a local Chromium renders fonts differently and CI will fail.
- A `ui/` branch can commit new baselines, so a restyle updates its screenshots in the same PR. Review the changed images in the PR diff.
- When CI fails on a screenshot, download the `playwright-report` artifact for the expected, actual and diff images.
- Keep the Playwright image tag in `e2e/compose.yml` in step with `@playwright/test`.

## API tests

API tests are compiled with SWC (`unplugin-swc`) so Nest's dependency injection works in Vitest. Unit tests (`src/**/*.test.ts`) run without a database.

Nothing in the API tests calls Claude. Replace the LLM adapter with `FakeLlmAdapter` (`src/llm/fake-llm.adapter.ts`) and queue one step per expected call: `reply(text)`, `replyJson(value)`, `refuse()`, `unconfigured()`, `fail(error)` or `hang()` (only the deadline ends it). `calls` records what was sent (model, system prompt, messages, `maxTokens`). The real `LlmService` still runs, so a feature test covers its JSON checks and fallback too. A call with nothing queued returns `upstream`.

```ts
const llm = new FakeLlmAdapter().replyJson([{ product: "Eggs", quantity: 20 }]);
const moduleRef = await Test.createTestingModule({ imports: [SalesModule] })
  .overrideProvider(LlmAdapter).useValue(llm)
  .compile();
```

`AnthropicAdapter`'s own tests stub `Anthropic.Messages.prototype.create`, so they check the real client's options without the network.

### API e2e tests

The e2e tests live in `apps/api/test/`. Each file boots the real `AppModule` (config, guards, HTTP pipeline, Prisma) with `createE2eApp()` from `test/harness.ts` and calls it with Supertest, against a throwaway Postgres migrated with `prisma migrate deploy`.

- `seedFixtures()` (`test/fixtures.ts`) creates two onboarded Businesses, `alpha` and `beta`, each with a Product, plus a signed-in user with no Business. Each fixture carries a session cookie made the way the App's Auth.js makes it.
- Call `resetDatabase()` in `beforeEach`: the files share one database and run one at a time.
- Every Business-owned route gets e2e tests that sign in as `alpha` and check that `beta`'s IDs return 404 and leave `beta`'s rows unchanged (the ADR-023 slice checklist).
- `test/isolation.e2e-spec.ts` covers the scoped Prisma client itself against the real database: its probe routes leave `businessId` out of every query, and the tests check reads, writes, transactions, foreign-key ownership, `$assertOwned()` and the fail-closed cases. The rules for each model and operation are unit-tested in `src/database/business-scope.test.ts`.
- To pin "now", pass a `FixedClock` as `createE2eApp({ clock })` and move it with `clock.set()`; don't fake the global clock (`vi.setSystemTime`), which also moves session expiry, log timestamps and Prisma's `updatedAt`. `test/calendar.e2e-spec.ts` shows the pattern. Unit tests construct `BusinessCalendar` with a `FixedClock` directly.
- `createE2eApp()` always replaces the LLM adapter with a `FakeLlmAdapter`, so no e2e test reaches Anthropic or Secrets Manager. Pass `createE2eApp({ llm })` with queued replies to drive a feature's LLM path.
- Logs are silent; run with `E2E_LOG=error` to see why a request returned a 500.

```bash
pnpm --filter @freshcast/api e2e:up      # Postgres (Docker), port 54330
pnpm --filter @freshcast/api test:e2e
pnpm --filter @freshcast/api e2e:down
```

The values in `test/env.ts` override `apps/api/.env`, and the harness refuses any database that isn't on localhost, because the tests empty every table.

## CI

GitHub Actions runs on every pull request and push to `main`: the `check` job (lint, type check, unit and component tests, guard script tests, build), `storybook`, `e2e` and `api-e2e`. On a pull request each job runs only when the files it tests changed, so an `apps/api` change skips `storybook` and `e2e`, and a docs-only change skips all four. See [Architecture §11.2](ARCHITECTURE.md#112-ci-and-branch-rules) for the jobs that must pass before merging.
