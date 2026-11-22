# apps/api: the API (NestJS)

The API replaces the Legacy API one domain at a time (ADR-020). ADR-023 owns its contract; read it before adding a route.

## Conventions

- ESM with NodeNext: relative imports end in `.js`.
- Env lives in `apps/api/.env` and is validated at startup by the Zod schema in `src/config/env.schema.ts`; add new required config there.
- Controllers return the resource as-is, or `paginated(items, meta)` from `src/common/pagination.ts` for lists.
- Expected errors throw `ApiException` with a code from `PROBLEM_CODES` (`@freshcast/shared`); the global filter turns every error into RFC 9457 Problem Details.
- Every route needs a session by default. Mark public routes with `@Public()`, and get the Business with `@CurrentBusiness()` (ADR-008).
- Query through the scoped client (`@InjectScopedPrisma()`), which adds the Business to every query (ADR-025). `businessId` isn't needed in `where`, except inside a compound unique key such as `businessId_date_type`; creates still pass `@CurrentBusiness().id`. Call `$assertOwned()` to reject IDs from a request body under their field name. Use `PrismaService` only in the places listed in [Architecture §4](../../docs/ARCHITECTURE.md#business-isolation-in-the-api).
- Dates are Business dates (ADR-013): import `CalendarModule`, call `BusinessCalendar.forBusiness(business)` once per request and pass the snapshot down. Read "now" only through the injected `Clock`; lint rejects `new Date()` and `Date.now()` in `src/`. See [Architecture §6.8](../../docs/ARCHITECTURE.md#68-date-utilities-adr-013).
- Request DTOs are Zod schemas through `nestjs-zod`; document success responses with `@ZodResponse`.
- Read Sales items totalled over a window through `SalesHistory` (import `SalesHistoryModule`), not a Sales query of your own. See [Architecture §6.10](../../docs/ARCHITECTURE.md#610-sales-history-api-162).
- Call Claude through `LlmService` (import `LlmModule`); only `src/llm/anthropic.adapter.ts` imports `@anthropic-ai/sdk`. Handle each failure `reason` in the feature module, which owns its prompt, schema and fallback. See [Architecture §6.9](../../docs/ARCHITECTURE.md#69-llm-module-api-145).
- Mark Claude and OCR routes `@RateLimit("costly")`.
- Log through Nest's `Logger`, which writes through pino.

## Tests

Unit tests sit beside the code; every Business-owned route also gets isolation e2e tests. See [docs/TESTING.md](../../docs/TESTING.md#api-tests).
