# ADR-023: API Contract Owned by the NestJS API

## Status
Accepted. Partially supersedes [ADR-020](020-dedicated-nestjs-backend.md): the API no longer reproduces the Legacy API's response shapes, Stage 5 is reduced, and the D3 bridge is pinned. D8 is refined.

## Date
2026-10-22

## Context

ADR-020 moves the backend from Next.js route handlers (the **Legacy API**) to a NestJS service (the **API**) one endpoint group at a time. Its issues treated the Legacy API's behaviour as the spec: "match the current `/api/health` response shape" (#28), "port services into a Nest module" (#36–#42), "dashboard data matches the Next.js implementation" (#39), "all pages render as before" (#43).

An audit of the Legacy API before the first business endpoint moved found design problems that parity would carry into the API:

- **Resources.** `PATCH /products` takes the product ID in the body. `PUT /sales/[id]` behaves as a partial update. `GET /auth/verify-email` consumes a token.
- **Status codes.** Deletes return 200 with a message. A broken business rule is a `VALIDATION_ERROR` 400. A disabled feature is a 503. `/api/health` returns 200 when the database is down.
- **Payloads.** Raw Prisma `include` trees are returned. `trend` is a number in one response and a preformatted `"+12%"` string in another. Calendar dates are sent as full datetimes in some routes and as `YYYY-MM-DD` in others.
- **Validation.** Query parameters bypass Zod, so a malformed `limit` or date becomes a 500. No response has a schema.
- **Services.** Every data service imports a global Prisma client, which leaves no seam for dependency injection. Insight generation does cache lookup, aggregation, the LLM call, fallback and persistence in one function.

Parity only protects consumers that depend on the current contract. The Legacy API has one consumer, the App, which lives in the same repository and is rewritten as part of the migration anyway. Nothing outside the App calls it: the weekly email is paused (#74), and no other client exists.

## Decision

### 1. The API owns its contract

Each endpoint is designed to the conventions below. The Legacy API is a reference for **behaviour**, not for **shape**. Each migration slice rewrites the App's callers to the new contract.

### 2. Domain behaviour does not change

A slice may change URLs, payload shapes and status codes. It may not change results: forecasts, holiday adjustments, rule-based and LLM parsing, insight logic and CSV columns stay the same. Existing unit tests move with their code. Where none exist (analytics, insight aggregation, dashboard figures), the slice first adds characterisation tests against the Legacy service with seeded fixtures, and the API must pass them. Correcting wrong behaviour is its own issue, not part of a slice.

### 3. Each slice is vertical and runs expand → switch → delete

1. **Expand:** ship the API endpoint. Nothing calls it yet.
2. **Switch:** one App deploy adds the proxy rewrite and moves that domain's client callers and server-rendered page reads to the API.
3. **Delete:** remove the Legacy route and any Prisma reads it replaced.

Rollback is reverting step 2. The API and the App deploy through separate pipelines, so this order is what keeps every deploy compatible.

Only endpoints the App calls are migrated. Each slice checks for callers again, including pages and server actions. Unused Legacy endpoints are deleted, not rebuilt.

### 4. The Legacy API is frozen

Legacy routes are not improved before they are deleted. Security fixes are the exception and land in the Legacy API at once (#110, #111).

### 5. Scope

Slices change structure and contract only. New product capabilities wait until the migration ends. Database schema changes are allowed only when an endpoint needs them, as separate expand/contract issues through `prisma migrate`. Until Stage 5 finishes, the App still reads the same tables.

### 6. Contract conventions

**Resources**
- Collections are plural, and IDs go in the path (`PATCH /products/:id`).
- The caller's own data lives under `/me`: `GET /me`, `DELETE /me`, `GET /me/business`.
- An operation that persists nothing is a POST to a verb under its resource (`POST /sales/parse`, `POST /receipts/parse`).
- Endpoints are named after what they create (`POST /receipts/upload-urls` returns presigned upload URLs).
- GET requests are safe. Generating insights on first read and caching them is allowed under RFC 9110 §9.2.1, because the client doesn't request the side effect. Email verification links don't consume the token on GET; that changes in Stage 6.
- `GET /dashboard` stays a screen-shaped read for the App, built from the domain services rather than its own queries.
- No URI versioning yet. It is added when a second consumer appears.

**Responses**
- A single resource is returned as-is, without an envelope.
- A paginated list is `{ items, meta: { total, limit, offset } }`. Pagination uses `?limit=&offset=`, validated by Zod, with `limit` capped at 100.
- Status codes: 201 with the created resource, 204 with no body for deletes, 200 otherwise.
- Calendar dates are `YYYY-MM-DD`, and timestamps are ISO 8601 in UTC.
- Numbers are sent raw, and the App formats them.
- Fields are camelCase. Optional fields that are unset are omitted.
- Every response has a Zod schema in `@freshcast/shared`. Prisma entities are never returned directly.

**Errors** use RFC 9457 Problem Details (`application/problem+json`):

```json
{
  "type": "https://api.freshcast.site/problems/entry-not-editable",
  "title": "Entry not editable",
  "status": 422,
  "detail": "Only today's entry can be edited.",
  "code": "ENTRY_NOT_EDITABLE"
}
```

- `type` identifies the problem. `code` is a short extension for clients to switch on, keeping the existing codes where they still fit. Validation errors add an `errors` extension with field-level messages.
- **400 `VALIDATION_ERROR`** is for schema failures only, including query parameters.
- **422** is for a broken business rule, each with its own code.
- **404** is for another business's IDs, so their existence isn't revealed.
- **409** is for conflicts.
- **429** comes with `Retry-After`.
- **503** is only for an unavailable dependency. A disabled feature is a 404 with `FEATURE_DISABLED`.

All codes are listed in the OpenAPI document (#27).

### 7. Health

- `GET /health/live` reports that the process is up, with version and uptime. The ALB target group checks this endpoint.
- `GET /health/ready` checks the database with `@nestjs/terminus` and returns 503 when the check fails. The deploy pipeline and monitoring use it.
- Both are `@Public()`, and neither returns business data.

### 8. Services

Services become NestJS providers that receive `PrismaService` by injection, as the NestJS and Prisma documentation show. There is no general repository layer. A query class is added only where a query is complex or shared between modules. Functions that combine several concerns are split into focused providers.

### 9. Rate limits

- Limits are set per route according to cost: strict on Claude and OCR routes, loose on CRUD.
- Requests are counted per business when signed in, and per client IP otherwise (with `trust proxy` behind the ALB).
- Storage stays in memory, per ADR-020 D8, only while the service runs one task. A shared Redis store comes with the second task.

### 10. The auth bridge is pinned

ADR-020 D3 step 1 stands: the API decrypts the Auth.js session cookie until Stage 6. The API depends on Auth.js's cookie format, so the `next-auth` version is pinned until Stage 6 removes it.

### 11. Stage 5 is reduced

Each slice moves its domain's page reads (decision 3), so Stage 5 only removes Prisma and the Legacy client helper from `apps/web`.

## Rationale

- **Parity only protects external consumers.** With one first-party consumer in the same repository, keeping the old contract would build known defects into the new service and still require App changes later.
- **Established norms over house style.** RFC 9110 semantics, RFC 9457 errors, unwrapped resources, plural resources and DTOs instead of entities are the conventions most API clients, tools and reviewers expect. NestJS returns handler values as-is by default. With nestjs-zod, unwrapped DTOs produce a clean OpenAPI document, while a success envelope needs a wrapper schema on every route.
- **Behaviour is held constant.** The tests are what show that a contract change didn't change any results.
- **Vertical slices end with nothing left over.** After a slice, nothing in the App reaches that domain except through the API, which is the single enforcement point ADR-008 needs.
- **Liveness and readiness are separate.** If the load balancer checked the database, a database outage would mark every task unhealthy and ECS would keep replacing them, instead of the API answering with 503s.
- **No repository layer by default.** Prisma is already the data mapper, and dependency injection already gives the test seam. A repository per model would mostly pass calls through.

## Consequences

- **Larger slices.** Each migration PR also changes App callers and pages.
- **Two client helpers during the migration.** The Legacy helper unwraps `{ data }`. The API client reads unwrapped resources and Problem Details. The Legacy helper is removed in Stage 5.
- **Rework of #26.** The `{ data }` interceptor and `{ error }` filter built in #26 change to unwrapped responses and Problem Details before any endpoint ships.
- **Contract changes are not atomic across deploys.** They're kept safe by the expand → switch → delete order. A tab left open across a switch may fail until it is refreshed. `public/sw.js` caches only the offline page, so no client code is served stale from the cache.
- **Some Legacy behaviour is rebuilt from scratch.** Endpoints without callers disappear, and #42 already replaces the weekly email.
- **Docs.** `docs/API.md` describes the Legacy API until Stage 5. API endpoints are documented by the OpenAPI document as they ship.

## Alternatives Considered

| Alternative | Why not |
|---|---|
| Shape parity with the Legacy API (ADR-020 as written) | Builds known defects into the API, and protects consumers that don't exist |
| Rewrite the whole backend, then cut over once | No production feedback until the end, no rollback per domain, and the App changes all at once |
| Fix the Legacy API first, then migrate | Polishes code that is about to be deleted |
| Keep the `{ data }` success envelope | Valid (JSON:API style), but not the NestJS or common REST default, and it complicates the generated OpenAPI |
| NestJS's default error body (`statusCode`, `message`, `error`) | Not a standard, and has no stable machine-readable code |
| Cursor pagination | The norm for large or changing feeds. One business's sales history is small, and the App pages by offset. It's the upgrade path if that changes |
| Repository layer over Prisma | Adds pass-through classes without a need to swap persistence |
| Move auth ownership first | Puts the riskiest change, the cookie domain move and every endpoint into one switch |
| `/v1` URI versioning now | Protects no consumer today. Nest's `enableVersioning` adds it later at bootstrap |

## References

- [ADR-008: Business Data Isolation & Privacy Model](008-data-isolation-privacy.md)
- [ADR-020: Dedicated NestJS Backend](020-dedicated-nestjs-backend.md)
- [ADR-021: API Hosting on ECS Fargate, Infrastructure as Code with AWS CDK](021-api-hosting-and-infrastructure-as-code.md)
- [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)
- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457)
- [Google AIP-136: Custom methods](https://google.aip.dev/136)
