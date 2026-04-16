# BizSense — Technical Design Document (TDD)

## 1. Document Overview

This document describes the technical architecture, data model, API contracts, component structure, and implementation details for BizSense. It is informed by the [PRD](./PRD.md) and the [Architecture Decision Records](./adr/README.md).

### Referenced ADRs

| ADR | Decision |
|-----|----------|
| [001](adr/001-authentication-strategy.md) | Email/password via Auth.js |
| [002](adr/002-sales-input-dual-mode.md) | Dual-mode sales input (NL + manual form) |
| [003](adr/003-rule-based-nl-parser.md) | Rule-based NL parser (now fallback — superseded by 011) |
| [004](adr/004-quantity-only-tracking.md) | Quantity-only tracking, no pricing |
| [005](adr/005-batch-processing-over-realtime.md) | Daily batch processing for insights |
| [006](adr/006-demand-prediction-approach.md) | Statistical demand prediction |
| [007](adr/007-tech-stack.md) | Next.js, Prisma, Neon, shadcn/ui |
| [008](adr/008-data-isolation-privacy.md) | Shared DB with application-level isolation |
| [009](adr/009-localization-architecture.md) | Localization-ready from day one |
| [011](adr/011-llm-integration-claude.md) | Claude Haiku for insights + NL parsing |
| [012](adr/012-ai-chat-implemented.md) | AI chat interface |
| [013](adr/013-timezone-aware-dates.md) | Timezone-aware date handling |
| [014](adr/014-multiple-daily-entries.md) | Multiple sales entries per day |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (Browser / PWA)             │
│  Next.js App Router · React 19 · Tailwind v4 · shadcn│
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────┐
│               Next.js Server (Vercel)                │
│  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │  App Router   │  │   API Routes (/api/*)        │ │
│  │  (SSR/RSC)    │  │   REST endpoints             │ │
│  └──────────────┘  └──────────┬───────────────────┘ │
│                                │                     │
│  ┌──────────────┐  ┌──────────▼───────────────────┐ │
│  │   Auth.js v5  │  │   Business Logic Services    │ │
│  │  (JWT)        │  │   Parser · Analytics ·       │ │
│  └──────┬───────┘  │   Predictions · Insights ·   │ │
│         │          │   Chat Context               │ │
│         │          └──────────┬───────────────────┘ │
│  ┌──────▼─────────────────────▼───────────────────┐ │
│  │         Prisma v7 ORM (PrismaPg adapter)        │ │
│  │    + Product ownership verification             │ │
│  └──────────────────────┬─────────────────────────┘ │
└─────────────────────────┼───────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│          PostgreSQL (Neon — Serverless)               │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│    Claude API (Anthropic Haiku 4.5)                   │
│    Insights · NL Parsing · AI Chat                    │
│    Fallback: templates (insights) / rule-based (parse)│
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│    Resend (Email Delivery)                            │
│    Password reset emails                              │
└──────────────────────────────────────────────────────┘
```


### 2.2 Project Structure

```
src/
├── app/
│   ├── (auth)/                     # Public auth routes (no app shell)
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/
│   │       ├── page.tsx
│   │       └── reset-password-form.tsx
│   ├── (app)/                      # Authenticated routes (with mobile nav)
│   │   ├── layout.tsx              # App shell with MobileNav
│   │   ├── error.tsx               # Error boundary
│   │   ├── loading.tsx             # Loading skeleton
│   │   ├── dashboard/
│   │   │   ├── page.tsx            # Server component (auth + data)
│   │   │   ├── dashboard-client.tsx # Client component (cards)
│   │   │   └── logout-button.tsx   # Settings link
│   │   ├── sales/
│   │   │   ├── page.tsx
│   │   │   ├── sales-input-client.tsx  # Dual-mode input
│   │   │   └── history/
│   │   │       ├── page.tsx
│   │   │       └── sales-history-client.tsx
│   │   ├── chat/
│   │   │   ├── page.tsx
│   │   │   └── chat-client.tsx
│   │   ├── products/
│   │   │   ├── page.tsx
│   │   │   └── products-client.tsx
│   │   ├── settings/
│   │   │   ├── page.tsx
│   │   │   └── settings-client.tsx
│   │   └── onboarding/
│   │       ├── page.tsx
│   │       └── onboarding-wizard.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts
│   │   │   ├── signup/route.ts
│   │   │   ├── forgot-password/route.ts
│   │   │   └── reset-password/route.ts
│   │   ├── account/route.ts        # DELETE account
│   │   ├── business/route.ts       # POST (onboarding) + GET
│   │   ├── products/route.ts       # GET + POST + PATCH
│   │   ├── sales/
│   │   │   ├── route.ts            # POST (create) + GET (list)
│   │   │   ├── [id]/route.ts       # GET + PUT + DELETE
│   │   │   ├── parse/route.ts      # POST (NL parse)
│   │   │   └── export/route.ts     # GET (CSV download)
│   │   ├── dashboard/route.ts      # GET (aggregated)
│   │   ├── predictions/route.ts    # GET (?horizon=day|week)
│   │   ├── insights/route.ts       # GET
│   │   ├── chat/route.ts           # POST
│   │   └── demo/route.ts           # POST (seed demo data)
│   ├── offline/page.tsx            # PWA offline fallback
│   ├── manifest.ts                 # PWA manifest
│   ├── global-error.tsx
│   ├── not-found.tsx
│   ├── layout.tsx                  # Root layout (providers, fonts, i18n)
│   ├── page.tsx                    # Redirect to /dashboard
│   └── globals.css                 # Tailwind + theme variables
├── components/
│   ├── ui/                         # shadcn/ui (button, card, input, etc.)
│   ├── shared/
│   │   ├── mobile-nav.tsx          # Bottom tab bar (5 tabs)
│   │   └── sw-register.tsx         # Service worker registration
│   └── providers.tsx               # SessionProvider + NextIntl + QueryClient
├── lib/
│   ├── prisma.ts                   # Prisma client singleton (PrismaPg adapter)
│   ├── auth.ts                     # Auth.js config (Credentials, JWT)
│   ├── claude.ts                   # Claude API client (generateText, generateJSON)
│   ├── email.ts                    # Resend email utility
│   ├── api-helpers.ts              # errorResponse, getBusinessId, getBusinessContext
│   ├── dates.ts                    # Timezone-aware date utilities
│   ├── logger.ts                   # Structured logging (color-coded, timestamped)
│   ├── rate-limit.ts               # In-memory rate limiter
│   ├── constants.ts                # Business types, known units, thresholds
│   ├── env.ts                      # Environment variable validation
│   ├── query-client.ts             # React Query defaults
│   └── utils.ts                    # cn() utility (tailwind-merge)
├── services/
│   ├── sales-parser.ts             # Rule-based NL parser (fallback)
│   ├── llm-sales-parser.ts         # Claude-powered NL parser (primary)
│   ├── product-matcher.ts          # Fuzzy matching (Levenshtein, substring)
│   ├── prediction-engine.ts        # Demand prediction (moving avg + weekday)
│   ├── insight-generator.ts        # LLM insights with template fallback
│   ├── analytics.ts                # Trend calculations, period comparisons
│   └── chat-context.ts             # Business data context builder for AI chat
├── hooks/
│   ├── use-sales.ts
│   ├── use-products.ts
│   ├── use-dashboard.ts
│   └── use-predictions.ts
├── i18n/
│   └── request.ts                  # next-intl request config
├── messages/
│   └── en.json                     # Externalized English strings (~150 keys)
├── types/
│   └── index.ts                    # NextAuth type extensions, ParsedItem
└── proxy.ts                        # Route protection (replaces middleware in Next.js 16)
```


---

## 3. Data Model

The complete Prisma schema is in `prisma/schema.prisma`. Key design decisions:

- **Prisma v7** with `prisma-client` generator (ESM, Rust-free) and `PrismaPg` adapter
- **`@db.Date`** for sales dates — stores calendar date only, no time component
- **Business isolation** — every data table has `businessId` foreign key; all queries scoped
- **Multiple entries per day** — no unique constraint on `(businessId, date)` for SalesEntry
- **Insight dedup** — `@@unique([businessId, date, type])` on DailyInsight prevents duplicates
- **Cascade deletes** — SalesItem cascades from SalesEntry; all business data cascades from Business

### Key Fields Added Post-MVP

| Model | Field | Purpose |
|-------|-------|---------|
| Business | `timezone` | IANA timezone for date calculations (auto-detected from browser) |
| SalesEntry | `rawInput` | Original NL text for audit trail (nullable, only for NL entries) |
| DailyInsight | `generationMethod` | `"template"` or `"llm"` — tracks which method produced the insight |

---

## 4. Authentication

### Auth.js v5 Configuration

- **Provider:** Credentials (email/password)
- **Session strategy:** JWT (stateless)
- **Password hashing:** bcrypt (cost factor 12)
- **Adapter:** Prisma Adapter (stores users, accounts, sessions in PostgreSQL)

### Auth Flow

```
Sign Up:    POST /api/auth/signup → validate → hash password → create User → redirect to /onboarding
Login:      POST /api/auth/callback/credentials → verify password → issue JWT
Reset:      POST /api/auth/forgot-password → generate token → send email via Resend
            POST /api/auth/reset-password → validate token → update password (atomic transaction)
```

### Route Protection

`src/proxy.ts` (Next.js 16's replacement for middleware) protects all `/(app)/*` routes. Public routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify`.

### Rate Limiting

In-memory sliding window rate limiter (`src/lib/rate-limit.ts`):
- Signup: 10 per IP per hour
- Forgot password: 3 per email per hour (silently drops excess to prevent enumeration)

---

## 5. API Contracts

### Conventions

- Base path: `/api/*`
- Content type: `application/json` (except CSV export)
- Auth: all routes except auth endpoints require valid session
- Business scoping: `businessId` from session, never from request body
- Error format: `{ error: { code, message, details? } }`
- Status codes: 200, 201, 400, 401, 404, 409, 422, 429, 500, 503

### 5.1 Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account (rate limited) |
| POST | `/api/auth/[...nextauth]` | Auth.js handler (login) |
| POST | `/api/auth/forgot-password` | Request password reset email (rate limited) |
| POST | `/api/auth/reset-password` | Set new password with token (atomic) |

### 5.2 Business

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/business` | Complete onboarding (name, type, timezone, products) |
| GET | `/api/business` | Get business profile |

### 5.3 Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products?active=true` | List products |
| POST | `/api/products` | Add product (duplicate check) |
| PATCH | `/api/products` | Update product (name, unit, deactivate) |

### 5.4 Sales

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sales` | Create sales entry (product ownership verified) |
| GET | `/api/sales?from=&to=&limit=&offset=` | List entries (paginated, date range) |
| GET | `/api/sales/[id]` | Get single entry |
| PUT | `/api/sales/[id]` | Update today's entry (atomic transaction, timezone-aware) |
| DELETE | `/api/sales/[id]` | Delete entry (cascade via DB) |
| POST | `/api/sales/parse` | Parse NL text (LLM first, rule-based fallback) |
| GET | `/api/sales/export` | Download CSV |

### 5.5 Dashboard & Intelligence

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Aggregated dashboard (single call, includes forecasts + insights) |
| GET | `/api/predictions?horizon=day\|week` | Demand forecasts |
| GET | `/api/insights` | AI-generated insights |
| POST | `/api/chat` | AI chat (message + history → Claude response) |

### 5.6 Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| DELETE | `/api/account` | Delete account + all data (cascade transaction) |
| POST | `/api/demo` | Load 14 days of demo data (empty accounts only) |


---

## 6. Core Services

### 6.1 Sales Parser — Dual Mode (ADR-003, ADR-011)

Two parsers with automatic fallback:

**LLM Parser** (`services/llm-sales-parser.ts`) — Primary
- Sends raw text + product list to Claude Haiku
- System prompt instructs structured JSON extraction
- Handles conversational input ("about two dozen eggs", "maybe 30 kilos of beef")
- Returns `ParsedItem[]` with `parseMethod: "llm"`

**Rule-Based Parser** (`services/sales-parser.ts`) — Fallback
- Tokenizes by commas and "and"
- Extracts quantity (number), unit (word-boundary regex), product name (remainder)
- Fuzzy matches against product catalog via `product-matcher.ts`
- Handles: "a dozen" → 12, "half kg" → 0.5, duplicate merging
- Unit regex uses word boundaries to avoid matching inside product names

**Product Matcher** (`services/product-matcher.ts`)
- Priority: exact → normalized (strip plural) → substring → Levenshtein (≤2) → unmatched

### 6.2 Prediction Engine (ADR-006)

`services/prediction-engine.ts` — Statistical demand prediction.

**Algorithm:** Weighted blend of weekday pattern (60%) + recent trend (40%)
- Weekday signal: average of last 4 same-weekday occurrences
- Recent signal: average of last 7 days
- Confidence: based on data volume (5/15/30 thresholds) adjusted by coefficient of variation
- Minimum: 5 sales entries before predictions activate
- Time horizons: next day + next 7 days

### 6.3 Insight Generator (ADR-005, ADR-011)

`services/insight-generator.ts` — LLM-powered with template fallback.

**LLM mode:** Sends aggregated analytics data to Claude, asks for 3-5 natural language insights as JSON. Cached in DB with `generationMethod: "llm"`.

**Template mode (fallback):** 5 insight types:
- TREND: per-product week-over-week change (≥10%)
- COMPARISON: overall week-over-week total
- TOP_PRODUCTS: top 3 concentration percentage
- SUMMARY: weekly aggregate stats
- SUMMARY: strongest/weakest weekday

**Caching:** Generated once per business per day. `@@unique([businessId, date, type])` prevents duplicates. `skipDuplicates: true` on insert handles concurrent requests.

### 6.4 Analytics Service

`services/analytics.ts` — Shared utilities for dashboard, insights, and predictions.

- `getTodaySummary(businessId, timezone)` — aggregates across multiple daily entries
- `getWeekSummary(businessId, timezone)` — 7-day totals with week-over-week comparison
- `getTopProducts(businessId, timezone, limit)` — ranked by quantity

### 6.5 Chat Context Builder (ADR-012)

`services/chat-context.ts` — Queries all relevant business data and formats as structured text for Claude.

Includes: today's sales, weekly totals by product, previous week comparison, weekday patterns, product list. Sent as the user message alongside the conversation history.

### 6.6 Date Utilities (ADR-013)

`lib/dates.ts` — All date operations use the business timezone.

- `getLocalDateStr(timezone)` — current date in business timezone
- `getTodayUTC(timezone)` — UTC midnight Date for today in business timezone
- `getDaysAgoUTC(timezone, n)` — UTC midnight Date for N days ago
- `getDayOfWeekFromDate(date)` — parses YYYY-MM-DD directly to avoid JS Date timezone issues

---

## 7. Frontend Architecture

### 7.1 State Management

- **Server state:** React Query (TanStack Query v5)
- **Form state:** react-hook-form + Zod v4
- **Chat state:** local useState (ephemeral, last 8 messages)
- **No global store** — React Query cache is sufficient

### 7.2 Mobile Navigation

Bottom tab bar with 5 tabs:

| Tab | Icon | Route |
|-----|------|-------|
| Home | ⌂ | `/dashboard` |
| Log Sales | + | `/sales` |
| Ask AI | 💬 | `/chat` |
| History | ☰ | `/sales/history` |
| Products | ▤ | `/products` |

Settings accessible from dashboard header (⚙ Settings link).

### 7.3 i18n

- Library: `next-intl` with Next.js 16 plugin
- ~150 translation keys in `src/messages/en.json`
- 8 namespaces: common, auth, onboarding, dashboard, sales, products, predictions, nav
- Adding a language: create `src/messages/{locale}.json`, update `src/i18n/request.ts`

### 7.4 PWA

- `src/app/manifest.ts` — app name, teal theme, standalone display, start URL `/dashboard`
- `public/sw.js` — network-first service worker with offline fallback
- `src/app/offline/page.tsx` — "You're offline" page
- Icons: 192x192, 512x512, 512x512 maskable, apple-touch-icon

---

## 8. Security

- Passwords: bcrypt cost factor 12
- Sessions: JWT via Auth.js (7-day expiry)
- CSRF: Auth.js built-in
- Rate limiting: in-memory sliding window on auth endpoints
- Input validation: Zod schemas on all API inputs
- SQL injection: Prisma parameterized queries
- XSS: React default escaping
- Data isolation: every query scoped to `businessId` from session
- Product ownership: verified before creating SalesItems
- Timezone validation: IANA string validated server-side via `Intl.DateTimeFormat`
- Atomic operations: sales updates wrapped in `$transaction`
- Token security: password reset tokens deleted atomically before password update

---

## 9. External Services

| Service | Purpose | Cost |
|---------|---------|------|
| Neon | PostgreSQL (serverless) | Free tier |
| Vercel | Hosting + deployment | Free tier |
| Anthropic (Claude Haiku 4.5) | NL parsing, insights, chat | ~$1-5/month at moderate usage |
| Resend | Password reset emails | Free tier (3000/month) |

---

## 10. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Auth.js session encryption key |
| `AUTH_URL` | Yes | Application URL (e.g., `https://bizsense.vercel.app`) |
| `ANTHROPIC_API_KEY` | No | Claude API key (LLM features degrade gracefully without it) |
| `RESEND_API_KEY` | No | Resend API key (password reset falls back to console.log) |

---

## 11. ADR Cross-Reference

| Concern | Decision | ADR |
|---------|----------|-----|
| Auth | Email/password via Auth.js | 001 |
| Sales input | Dual mode (NL + manual form) | 002 |
| NL parsing | LLM primary, rule-based fallback | 003 → 011 |
| Data tracking | Quantity only, no pricing | 004 |
| Insight timing | Daily batch, on-demand trigger | 005 |
| Predictions | Statistical (moving avg + weekday) | 006 |
| Tech stack | Next.js 16, Prisma 7, Neon, shadcn/ui | 007 |
| Data privacy | Shared DB, app-level business isolation | 008 |
| Localization | Architecture-ready, English only | 009 |
| AI chat | Implemented with Claude + data context | 012 |
| Timezones | Business timezone stored, all dates TZ-aware | 013 |
| Daily entries | Multiple per day, no unique constraint | 014 |
