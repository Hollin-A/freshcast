# ADR-008: Business Data Isolation & Privacy Model

## Status
Accepted

## Date
2026-03-29

## Context

Freshcast handles business sales data that owners consider sensitive. Trust is critical for adoption — small business owners need confidence that their data is private and not shared or compared with competitors.

Options considered:

1. **Shared database with row-level filtering** — all businesses in one DB, filtered by businessId; simple but risk of data leaks through query bugs
2. **Shared database with strict application-level isolation** — same DB, but every query enforced through middleware/ORM scoping; good balance of simplicity and safety
3. **Separate databases per business** — maximum isolation but operationally complex and expensive at scale

## Decision

Shared database with strict application-level isolation. Every database query is scoped to the authenticated business's ID through middleware and ORM-level enforcement.

## Rationale

- Separate databases per business is overkill for MVP and creates operational burden
- Shared database with strict scoping is the industry standard for multi-tenant SaaS
- Prisma middleware can enforce `businessId` filtering on every query automatically
- Simpler to manage, backup, and migrate than per-tenant databases
- Sufficient for the privacy guarantees Freshcast promises

## Implementation Approach

1. Every data table includes a `businessId` foreign key
2. Prisma middleware automatically injects `businessId` filter on all read/write operations
3. API routes extract `businessId` from the authenticated session
4. No API endpoint returns data without business scoping
5. AI insight generation receives only the requesting business's data

## Privacy Rules

- No data sharing between businesses
- No benchmarking or aggregation across businesses in MVP
- No competitor insights
- AI prompts include only the authenticated business's data
- Clear user-facing privacy messaging in the app

## Consequences

- Every query must include business scoping — missed scoping = data leak (mitigated by middleware)
- Cannot do cross-business analytics or benchmarking (explicitly a non-goal for MVP)
- Single database simplifies operations but requires careful access control
- Prisma middleware adds a small overhead per query (negligible)

## Future Considerations

- Phase 6: Opt-in anonymous aggregated insights would require a separate analytics pipeline
- Row-level security at the PostgreSQL level could be added as a defense-in-depth measure
- If multi-user per business is added, permissions layer sits on top of business isolation
