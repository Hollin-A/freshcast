# ADR-020: Dedicated NestJS Backend (Incremental Migration from Next.js API Routes)

## Status
Accepted — partially supersedes [ADR-007](007-tech-stack.md) (the "API routes eliminate the need for a separate backend service" rationale and the rejected "Express.js backend" alternative)

## Date
2026-09-25

## Context

ADR-007 chose Next.js API routes as the backend because a full-stack framework removed the need for a separate service during the MVP. Since then the backend has grown to 22 route handlers, framework-independent domain services (`src/services/`), five AWS integrations (S3, Textract, SES, EventBridge, Secrets Manager), and three Claude-backed features (NL parsing, insights, chat). Several structural problems have emerged at this size.

**Cross-cutting concerns are repeated by hand in every route.** Each handler calls `getBusinessId()` or `getBusinessContext()` itself (12 route files), runs its own Zod `.parse()`, and shapes errors through `errorResponse()`. Nothing enforces that a new route does any of this. A route that forgets the business lookup breaks the isolation guarantee in [ADR-008](008-data-isolation-privacy.md), and no review step would catch it structurally.

**Business isolation has more than one enforcement point.** Besides the API routes, the app layout and eight server-rendered pages call `auth()` and `prisma` directly. Access rules for the data layer therefore live in two places, API handlers and page components, with different code paths.

**The in-memory rate limiter doesn't work under serverless hosting.** `src/lib/rate-limit.ts` keeps its counters in a process-local `Map`. Its own header comment notes that serverless instances don't share that memory, so it provides only "basic protection". Under Amplify's SSR Lambda, each concurrent instance has its own counters, which weakens the limits on the LLM- and OCR-backed endpoints that most need them.

**Backend runtime limits are set by the frontend host.** API routes run inside the Amplify SSR compute. The slowest and most expensive operations (Claude calls, Textract `AnalyzeExpense`, chat) share that runtime's timeouts, cold starts and scaling behavior with page rendering, and can't be tuned separately.

**Identity is owned by the frontend framework.** Auth.js v5 issues an encrypted, host-only session cookie from Next.js, and `src/proxy.ts` gates routes by checking for it. Any consumer of the API other than the Next.js app itself has no supported way to authenticate.

**Frontend and backend are coupled at build and deploy time.** A backend-only change rebuilds and redeploys the frontend. Types cross the boundary by direct import (for example, `src/hooks/use-sales.ts` imports `ParsedItem` from `src/services/sales-parser.ts`).

**The API contract is maintained by hand.** `docs/API.md` is written separately from the handlers, so it can drift from actual behavior without anything flagging it.

Current request volume doesn't require a separate service; this decision is about structure, not throughput.

## Decision

Move the backend into a dedicated **NestJS** application, incrementally (strangler-fig pattern), with Next.js remaining the frontend. The application stays operational at every step, and each stage ships independently.

NestJS addresses the problems above directly:
- **Guards** give one declarative authentication and business-scoping point for every route.
- **Pipes** validate input before handlers run.
- **Exception filters** shape all errors centrally.
- **Interceptors** handle request logging and response shaping.
- **Modules with dependency injection** keep domain services testable in isolation.
- **Generated OpenAPI documentation** stays in sync with the code.
- **A long-running process** makes rate limiting and runtime limits the backend's own concern.

### D1 — Monorepo with pnpm workspaces and Turborepo

Restructure this repository into:

```
apps/web         Next.js frontend (UI only by the end of the migration)
apps/api         NestJS backend
packages/db      Prisma schema, migrations, generated client
packages/shared  Zod schemas and TypeScript types shared by web and api
```

pnpm is the package manager (strict dependency isolation, `workspace:` protocol, fast installs); Turborepo is the task runner (dependency-aware, cached `build`/`test`/`lint` across packages).

### D2 — Same-origin proxy during migration, direct API domain at the end

- **During migration:** Next.js rewrites forward `/api/*` routes, one group at a time, to the NestJS service. The browser keeps calling same-origin `/api/...`. This is required while Auth.js owns identity, because its session cookie is host-only and would not be sent to a separate API host.
- **After auth moves (Stage 6):** the browser calls `api.freshcast.site` directly. Session cookies are scoped to `.freshcast.site` (same-site with the frontend), and the API enforces a CORS allowlist. The proxy is removed, so API traffic no longer passes through the frontend's runtime.

### D3 — Two-step authentication handover

1. **Verify:** a NestJS guard validates the existing Auth.js session cookie, so migrated endpoints work without changing login.
2. **Own:** NestJS takes over signup, login, password reset and email verification (Passport JWT strategy, short-lived access token plus rotating refresh token, both in `httpOnly` `Secure` cookies). Auth.js is removed.

### D4 — Zod for validation

Request validation uses Zod through `nestjs-zod`, with the schemas living in `packages/shared` so web and api validate against the same definitions. OpenAPI documentation is generated from those schemas.

### D5 — ECS Fargate hosting, deployed early

- The API runs as a container on **Amazon ECS Fargate** behind an Application Load Balancer in `ap-southeast-2` (same region as Neon and the other AWS services).
- Tasks run in public subnets with a restrictive security group. No NAT gateway, which keeps the baseline cost low.
- The first deployment is a **walking skeleton** in Stage 3: health endpoint only, with the full CI/CD pipeline in place before any business endpoint moves.
- CI/CD uses GitHub Actions with **GitHub OIDC** federation to AWS, so no long-lived AWS keys are stored in GitHub. Merges to `main` build the image, push it to ECR, and deploy it to ECS.
- Whether to add a staging environment is decided in Stage 3.

### D6 — EventBridge remains the scheduler

The weekly summary email stays triggered by Amazon EventBridge, now calling a NestJS endpoint. This fires once regardless of how many API tasks run. The Vercel Cron fallback is removed.

### D7 — Vercel mirror retired

The Vercel deployment is retired. Keeping it would mean hosting the API twice, and a `vercel.app` origin is cross-site to `freshcast.site`, which is incompatible with the D2 cookie model. Amplify remains the frontend host.

### D8 — `@nestjs/throttler` for rate limiting

The in-memory limiter becomes `@nestjs/throttler`. In-memory storage is correct while the API runs as a single long-lived task. If the service scales out, the storage moves to Redis.

### D9 — Infrastructure as code (optional)

The API's AWS resources (ECR, ECS service and task definition, ALB, security groups, OIDC role) may be codified with AWS CDK (TypeScript) in the final stage.

### Working practices

- **Trunk-based development:** short-lived branches (`feat/…`, `fix/…`, `docs/…`, `chore/…`) merged to an always-deployable `main` through PRs with CI. No long-lived migration branch.
- **Rollback per route group:** removing a rewrite sends the traffic back to the Next.js handler until that handler is deleted.
- **Tracking:** GitHub Issues with one milestone per stage, linked from PRs.
- **Dev data:** Neon branches (or a local Postgres container) for development and e2e tests.

## Migration Stages

| Stage | Scope | Exit criterion |
|---|---|---|
| 0 — Plan | This ADR; GitHub milestones and issues | Decisions recorded, work ticketed |
| 1 — Prepare in place | Consistent response envelope, request logging with request IDs, index audit, remove Next.js imports from `src/services`, consolidate Zod schemas | No behavior change; tests pass |
| 2 — Monorepo | pnpm + Turborepo; `apps/web`, `packages/db`, `packages/shared`; CI and Amplify updated | Site deploys and behaves as before |
| 3 — Walking skeleton | NestJS app (config/secrets, Prisma, exception filter, logging, Swagger, `/health`, Auth.js-cookie guard); Docker; ECS deploy via OIDC CI/CD; `/api/health` routed through | A production request round-trips web → api |
| 4 — Migrate endpoints | 4a business/products/account · 4b sales · 4c dashboard/predictions/insights · 4d receipts · 4e chat · 4f weekly email/demo. Each: port, test (unit + e2e), switch the rewrite, delete the old route | All non-auth `/api/*` served by NestJS |
| 5 — Web as pure client | Layout and pages fetch through the API; Prisma removed from `apps/web` | Frontend has no database access; single enforcement point for data access |
| 6 — Auth ownership | D3 step 2; direct `api.freshcast.site` with cross-subdomain cookies and CORS; proxy and Auth.js removed | Single identity provider in the API |
| 7 — Hardening and docs | Sentry for the API, public OpenAPI, `docs/API.md` generated from the spec, optional CDK | Docs and operations reflect the new architecture |

After Stage 4 the system is already a coherent frontend/API split. Stages 5–7 complete it and can be scheduled independently.

## Rationale

- **Portable logic, repeated plumbing.** The domain services move almost unchanged. The main gain is replacing plumbing that every route repeats with framework mechanisms that apply to all routes by default. A missing guard becomes a visible omission rather than a silent gap.
- **One place for access control.** Routing all data access through API guards (Stage 5) makes the ADR-008 isolation guarantee enforceable in a single layer.
- **Runtime fit.** A long-running container gives rate limiting a shared counter, avoids per-request cold starts on the slowest endpoints, and lets backend timeouts and resources be set independently of page rendering.
- **Incremental over big-bang.** Routing one endpoint group at a time keeps production working, keeps each PR reviewable, and gives every step a rollback.
- **Proxy first, direct later.** The same-origin proxy is the lowest-risk bridge while Auth.js owns the cookie. Once identity lives in the API, direct access removes the extra hop and leaves an API that any authenticated client can use.
- **Shared Zod schemas** keep one source of truth for request shapes on both sides of the network boundary, which matters more here than following NestJS's class-validator default.
- **Fargate over Lambda** because NestJS's startup cost makes Lambda cold starts poor for this workload, and a long-running process is what makes D8 correct.

## Consequences

- **Two deployables.** Two pipelines, two sets of logs and alarms, and a version-compatibility concern between web and api. `packages/shared` and e2e tests mitigate drift.
- **Added fixed cost.** One small Fargate task plus an ALB, running continuously, where the current API runs on usage-billed serverless compute.
- **Extra network hop during migration.** Proxied calls pass through the Amplify SSR runtime and inherit its timeouts. This is temporary and removed in Stage 6. Amplify's support for rewrites to an external origin must be verified in Stage 3; if it is unsupported, the direct-domain switch moves earlier.
- **Database connections from two apps.** Both use Neon's pooled connection string.
- **Session invalidation.** Replacing Auth.js in Stage 6 invalidates existing sessions; signed-in clients re-authenticate once.
- **Docs change shape.** `docs/ARCHITECTURE.md`, `docs/API.md` (eventually generated from OpenAPI), `README.md` and `CONTRIBUTING.md` are updated as each stage lands.

## Alternatives Considered

| Alternative | Why not |
|---|---|
| Stay on Next.js API routes (ADR-007 status quo) | Works at current load, but leaves auth, validation and business scoping as per-route conventions, the rate limiter ineffective, and backend runtime tied to the frontend host |
| Keep Next.js routes but add shared middleware/wrappers | Would address some of the repetition, but not identity ownership, runtime limits, rate-limiter state or deploy coupling |
| Express or Fastify without a framework | Would re-create by hand what NestJS provides (DI, modules, guards, pipes, filters) and still need conventions to enforce them |
| Big-bang rewrite on a long-lived branch | High risk and hard to review; no production feedback until the end |
| Separate `freshcast-api` repository | Types and schemas drift across repos; contracts can't change atomically |
| npm workspaces | Works, but no strict dependency isolation; pnpm is the prevailing monorepo choice |
| Nx instead of Turborepo | More powerful but heavier and more opinionated than a two-app repo needs |
| Browser calls API domain directly from day one | Blocked by the host-only Auth.js cookie until identity moves; would force the auth rewrite first, the riskiest step |
| `class-validator` DTOs | Idiomatic NestJS, but would duplicate validation rules already expressed in Zod on the frontend |
| AWS Lambda for the API | Poor cold-start behavior for NestJS; reintroduces the per-instance rate-limiter problem |
| App Runner | Simpler to operate, but less control over networking and task configuration; availability for new accounts should not be assumed |
| `@nestjs/schedule` for the weekly email | Runs once per task instance; EventBridge fires exactly once |

## References

- [ADR-007: Technical Stack Selection](007-tech-stack.md)
- [ADR-008: Business Data Isolation & Privacy Model](008-data-isolation-privacy.md) (the business-scoping guarantees must hold in the new guards)
- [ADR-017: No Runtime Env in `next.config`](017-next-config-no-env.md) (relevant to how rewrite destinations are configured)
- [ADR-018: Secrets in AWS Secrets Manager](018-secrets-manager.md) (the resolver ports to the NestJS ConfigModule)
