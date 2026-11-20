# ADR-025: Business Scoping Through a Scoped Prisma Client

## Status
Accepted. Supersedes the implementation approach of [ADR-008](008-data-isolation-privacy.md) (Prisma middleware). ADR-008's decision, a shared database with strict application-level isolation, stands.

## Date
2026-11-20

## Context

ADR-008 says Prisma middleware adds `businessId` to every query. That middleware was never built. Each Legacy API handler adds `where: { businessId }` itself, and #110 and #111 show what happens when one is missed. Prisma has since replaced middleware (`$use`) with client extensions, and the Prisma 7 client this repo uses no longer has `$use`.

The API had kept the same pattern: `SessionGuard` resolves the Business from the session (#29), and each service method was still expected to add the filter. Stage 4 rewrites every data access path (#36–#43), so enforcement had to be central before the slices land (#127).

ADR-023 keeps `PrismaService` with no repository layer, so the enforcement point is the Prisma client itself.

## Decision

### 1. One scoped client, reading the Business from the request context

Services inject the **scoped client** with `@InjectScopedPrisma()` and leave `businessId` out of their queries. It is a Prisma client extension (`$extends` with a `query` component) built once, over `PrismaService`'s connection pool. On every query it reads the Business from a per-request context (`nestjs-cls`, built on Node's AsyncLocalStorage), which `SessionGuard` fills from the session. A business ID is never taken from a request's path, query or body.

### 2. What the client does to each query

The rules live in `apps/api/src/database/business-scope.ts`, as pure functions:

- **Reads, updates and deletes** get the scope added to `where`, under `AND`, so a caller's own conditions can only narrow the result. Owned models (`Product`, `SalesEntry`, `DailyInsight`, `DemandForecast`) match `businessId`. `SalesItem` matches through `salesEntry.businessId`. `Business` matches its own `id`, and allows only reads and updates.
- **Creates** get `businessId` set. A create for another Business is refused. Prisma's generated types still require `businessId`, so services pass the session's, and the client checks it matches.
- **Owner fields never change.** Writes can't set `businessId`, a Sales item's `salesEntryId`, or a Business's `id` or `userId`.
- **Nested writes are refused**, except a Sales entry's own items (`create`, `createMany`, `deleteMany`). The items' own data is checked the same way, recursively, so an item can't carry a relation such as `product: { connect }`. `connect`, `set` and the like are never allowed.
- **Foreign keys are checked.** Every `productId` a write stores, including in nested items, must be one of the Business's Products, or the write answers `400 VALIDATION_ERROR`. The scope filters which rows a query matches, not the IDs written into them (#110).
- **No path into the auth tables.** `User`, `Account`, `Session` and `VerificationToken` aren't on the client, and `include`/`select` can't reach them at any depth (such as a Business's `user` and its OAuth tokens).
- **Classification is complete.** Every model and every relation must be listed with its scope or target, or typecheck fails. Anything the rules don't know is refused.

### 3. Fail closed

Without a Business in the context the client throws: `403 BUSINESS_REQUIRED` for a signed-in user before onboarding (as `@CurrentBusiness()` answers), and a 500 programming error with no session at all (a `@Public()` route, or outside a request, such as a job).

### 4. Only the scoped surface

The client exposes the Business-owned model delegates, `$transaction` and `$assertOwned()`, in its types and at runtime, including on the transaction client. Raw SQL (`$queryRaw`, `$executeRaw` and their `Unsafe` variants), `$extends` and the connection methods throw. `$assertOwned(model, ids, field)` checks IDs from a request body up front and names the request field in the 400.

### 5. Unscoped access is listed

The unscoped `PrismaService` is used only in the places listed in [Architecture §4](../ARCHITECTURE.md#business-isolation-in-the-api): the auth bridge, the module that builds the scoped client, and the readiness check. `src/database/unscoped-uses.test.ts` fails when another file injects `PrismaService` or builds a Prisma client. Jobs that work across businesses, such as the Weekly summary (#42), are added to that list when they land.

## Rationale

- **A query extension is Prisma's supported way** to change every query; middleware is gone from the Prisma 7 client.
- **Request context, not a request-scoped provider.** Nest's request scope spreads up the dependency chain: every provider that injects a request-scoped one becomes request-scoped too, which costs an instance per request and rules out singletons such as the Business calendar (#143). AsyncLocalStorage via `nestjs-cls` is the common Nest approach for per-request tenant data.
- **Fail closed over fail open.** A forgotten filter or a missing Business should break loudly in development, not leak quietly in production.
- **Allowlists over blocklists.** The client began by hiding a list of `$` methods. The extended client also inherits `PrismaService`'s lifecycle hooks, and Nest called them on the scoped provider too, so the client now exposes only what services need.
- **The same context serves row-level security** (#128): it can set the session variable a Postgres policy reads.

## Consequences

- Services can't forget the filter; a missed scope is a failing test or a 500, not a leak.
- Creates still name `businessId`, because of Prisma's types; the client checks it.
- A foreign-key check is one extra query per write that stores `productId`. It reads committed rows, so a Product created earlier in the same transaction isn't visible to it.
- New models and relations need a line in `business-scope.ts` before they typecheck.
- The Legacy API keeps scoping by hand until each domain moves to the API (ADR-023).

## Alternatives Considered

- **Prisma middleware (`$use`)**, as ADR-008 planned. Not available in Prisma 7.
- **A request-scoped provider** returning an extended client per request. Rejected for the scope spreading described above.
- **A repository layer** that adds `businessId` in each method. ADR-023 keeps no repository layer, and a forgotten filter in a repository leaks just as one in a service does.
- **Postgres row-level security now.** Stronger, but needs a non-owner database role and its own migration work. Planned as defence in depth (#128), not instead of this.

## References

- [ADR-008: Business Data Isolation & Privacy Model](008-data-isolation-privacy.md)
- [ADR-023: API Contract Owned by the NestJS API](023-api-contract-owned-by-nestjs.md)
- #127 (this decision), #128 (row-level security), #110, #111
