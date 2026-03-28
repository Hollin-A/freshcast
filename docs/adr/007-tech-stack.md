# ADR-007: Technical Stack Selection

## Status
Accepted

## Date
2026-03-29

## Context

BizSense is a mobile-first web application that needs to be built quickly (4-week MVP timeline) with a small team. The stack must support:

- Server-side rendering for mobile performance
- API routes for backend logic
- Database ORM for structured data
- AI API integration for insight generation
- Localization support
- Component library for rapid UI development

## Decision

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Data Fetching | React Query (TanStack Query) |
| Database | PostgreSQL (Neon) |
| ORM | Prisma |
| AI | OpenAI API (or equivalent) |
| Localization | next-intl (or equivalent) |
| Deployment | Vercel (natural fit for Next.js) |

## Rationale

### Next.js (App Router)
- Full-stack framework — API routes eliminate the need for a separate backend service
- Server components improve mobile performance (less JS shipped to client)
- App Router provides modern patterns (layouts, loading states, error boundaries)
- Large ecosystem and community support
- Already initialized in the workspace

### Tailwind CSS + shadcn/ui
- Tailwind enables rapid, consistent styling without context-switching to CSS files
- shadcn/ui provides accessible, customizable components (not a dependency — components are copied into the project)
- Both are mobile-responsive by default
- shadcn/ui components are built on Radix UI primitives (accessibility built-in)

### PostgreSQL (Neon) + Prisma
- PostgreSQL is battle-tested for relational data (business → products → sales entries → items)
- Neon provides serverless PostgreSQL — scales to zero, no server management, generous free tier
- Prisma provides type-safe database access, migrations, and schema management
- Strong fit for the relational data model defined in the PRD

### React Query
- Handles server state management (caching, refetching, optimistic updates)
- Reduces boilerplate for data fetching in client components
- Built-in support for loading/error states

### OpenAI API
- Used for AI insight generation (batch, not per-interaction)
- Flexible model selection (can switch between GPT variants based on cost/quality)
- Well-documented API with good SDK support

## Consequences

- Tied to the Vercel/Next.js ecosystem (acceptable for MVP, portable if needed)
- Neon's serverless model means cold starts on first query (mitigated by connection pooling)
- Prisma adds a build step for client generation
- OpenAI API costs scale with number of businesses (mitigated by batch processing — ADR-005)

## Alternatives Considered

| Alternative | Why Not |
|---|---|
| Express.js backend | Separate service adds deployment complexity; Next.js API routes sufficient for MVP |
| MongoDB | Relational data model (business → products → sales) fits SQL better |
| Supabase | Good option but Neon + Prisma gives more control over the ORM layer |
| Material UI | Heavier bundle, less customizable than shadcn/ui for mobile-first design |
| tRPC | Adds complexity; React Query + API routes is simpler for MVP scope |
