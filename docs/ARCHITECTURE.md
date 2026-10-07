# Freshcast — Architecture

## 1. Document Overview

This is the canonical technical reference for Freshcast: system architecture, data model, core service algorithms, frontend structure, security, and operational concerns. Endpoint-level request/response contracts live in the [API Reference](./API.md); the decisions behind the architecture are recorded in the [Architecture Decision Records](./adr/README.md).

### Referenced ADRs

| ADR | Decision |
|-----|----------|
| [001](adr/001-authentication-strategy.md) | Email/password via Auth.js |
| [002](adr/002-sales-input-dual-mode.md) | Dual-mode sales input (NL + manual form) |
| [003](adr/003-rule-based-nl-parser.md) | Rule-based NL parser (now fallback for the typed Log/NL tab; superseded by 011 as primary; receipt-path scope clarified by 019) |
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
| [015](adr/015-holiday-aware-predictions.md) | Region-based holiday multipliers on predictions |
| [016](adr/016-editorial-rebrand.md) | Editorial rebrand (warm palette, serif headings) |
| [017](adr/017-next-config-no-env.md) | No `next.config` `env`; route via `amplify.yml` → `.env.production` |
| [018](adr/018-secrets-manager.md) | Hybrid env→Secrets Manager resolver for vendor API keys + cron secret |
| [019](adr/019-receipt-ocr-hardening.md) | Receipt OCR is LLM-only by default; Textract migrated to `AnalyzeExpense` |
| [020](adr/020-dedicated-nestjs-backend.md) | Dedicated NestJS backend, migrated incrementally in a pnpm + Turborepo monorepo |
| [021](adr/021-api-hosting-and-infrastructure-as-code.md) | API on ECS Fargate + ALB; infrastructure as code with AWS CDK from Stage 3; DNS via the existing Route 53 zone |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Client (Browser / PWA)                                   │
│ Next.js App Router · React 19 · Tailwind v4 · shadcn/ui  │
│ Forms validate with @freshcast/shared (Zod)              │
└──────────────────────────────────────────────────────────┘
                              │ HTTPS · freshcast.site
                              ▼
┌──────────────────────────────────────────────────────────┐
│ apps/web: Next.js SSR on AWS Amplify                     │
│                                                          │
│ proxy.ts        session check · request IDs              │
│ App Router      pages (SSR/RSC)                          │
│ API routes      REST, { data } / { error } envelope,     │
│                 withRequestLogging (JSON logs)           │
│ Auth.js v5      credentials, JWT sessions                │
│ Services        parsers · analytics · predictions ·      │
│                 insights · chat context · weekly email   │
│                                                          │
│ @freshcast/shared   Zod schemas, API types, constants    │
│ @freshcast/db       createPrismaClient() (Prisma + pg)   │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ PostgreSQL (Neon, serverless)                            │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Claude API (Anthropic Haiku 4.5)                         │
│ Insights · NL parsing · receipt mapping · chat           │
│ Fallbacks: templates (insights), rule-based (NL),        │
│ 503 (receipts, see ADR-019)                              │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ AWS                                                      │
│ SES: auth emails (Resend fallback)                       │
│ S3 + Textract AnalyzeExpense: receipts (off by default)  │
│ Secrets Manager: Anthropic, Resend, cron secret          │
│ CloudWatch: request and application logs                 │
│ Weekly summary scheduling: paused, rebuild in #42        │
└──────────────────────────────────────────────────────────┘
```


### 2.2 Project Structure

The repo is a pnpm workspace built with Turborepo (ADR-020):

```
freshcast/
├── apps/
│   └── web/                     # @freshcast/web: Next.js app (pages, API routes, services)
│       ├── src/                 # see the tree below
│       ├── scripts/             # materialize-next-aliases.mjs (post-build, see §12)
│       └── public/
├── packages/
│   ├── db/                      # @freshcast/db: Prisma schema, migrations, seed, createPrismaClient()
│   │   ├── prisma/              # schema.prisma, migrations/, seed.ts
│   │   └── src/                 # client factory + generated client (gitignored)
│   └── shared/                  # @freshcast/shared: Zod schemas, envelope types, constants
│       └── src/schemas/         # auth, business, products, sales, receipts, chat, api
├── docs/                        # ARCHITECTURE, API, ADRs
├── amplify.yml                  # Amplify monorepo build (appRoot: apps/web)
├── turbo.json                   # Turborepo task graph
└── pnpm-workspace.yaml          # workspace packages, allowBuilds, nodeLinker: hoisted
```

The web app's source tree (`apps/web/src/`):

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
│   │   │   ├── reset-password/route.ts
│   │   │   ├── send-verification/route.ts
│   │   │   └── verify-email/route.ts
│   │   ├── account/route.ts        # DELETE account
│   │   ├── business/route.ts       # POST (onboarding) + GET + PATCH (toggles)
│   │   ├── products/route.ts       # GET + POST + PATCH
│   │   ├── sales/
│   │   │   ├── route.ts            # POST (create) + GET (list)
│   │   │   ├── [id]/route.ts       # GET + PUT + DELETE
│   │   │   ├── parse/route.ts      # POST (NL parse)
│   │   │   └── export/route.ts     # GET (CSV download)
│   │   ├── receipts/
│   │   │   ├── upload/route.ts     # POST (presigned S3 upload URL)
│   │   │   └── parse/route.ts      # POST (Textract AnalyzeExpense -> LLM receipt parser, structured fallback opt-in)
│   │   ├── dashboard/route.ts      # GET (aggregated)
│   │   ├── predictions/route.ts    # GET (?horizon=day|week)
│   │   ├── insights/route.ts       # GET
│   │   ├── chat/route.ts           # POST
│   │   ├── email/
│   │   │   └── weekly-summary/route.ts  # POST (bearer CRON_SECRET; currently not scheduled, see 6.7)
│   │   ├── health/route.ts         # GET (DB + last-insight liveness probe)
│   │   └── demo/route.ts           # POST (seed demo data)
│   ├── offline/page.tsx            # PWA offline fallback
│   ├── manifest.ts                 # PWA manifest
│   ├── global-error.tsx
│   ├── not-found.tsx
│   ├── layout.tsx                  # Root layout (providers, fonts, i18n)
│   ├── page.tsx                    # Redirect to /dashboard
│   └── globals.css                 # Tailwind + theme variables
├── components/
│   ├── ui/                         # shadcn/ui (button, card, input, password-input, etc.)
│   ├── shared/
│   │   ├── mobile-nav.tsx          # Bottom tab bar (5 tabs)
│   │   └── sw-register.tsx         # Service worker registration
│   └── providers.tsx               # SessionProvider + NextIntl + QueryClient
├── lib/
│   ├── prisma.ts                   # Prisma client singleton (PrismaPg adapter)
│   ├── auth.ts                     # Auth.js config (Credentials, JWT)
│   ├── claude.ts                   # Claude API client (generateText, generateJSON)
│   ├── email.ts                    # SES-first email utility with Resend fallback
│   ├── ses.ts                      # AWS SES client (server-only)
│   ├── s3.ts                       # AWS S3 client + presigned PUT helper (server-only)
│   ├── textract.ts                 # AWS Textract AnalyzeExpense wrapper + line-item mapping
│   ├── secrets.ts                  # Hybrid env→Secrets Manager resolver (ADR-018)
│   ├── aws-config.ts               # Shared AWS SDK runtime config (region + credentials)
│   ├── api-helpers.ts              # ok, errorResponse, getBusinessId, getBusinessContext
│   ├── api-client.ts               # Client fetch helper: apiFetch unwraps { data }, throws ApiRequestError
│   ├── request-context.ts          # Per-request context (request ID) via AsyncLocalStorage
│   ├── request-logging.ts          # withRequestLogging route wrapper (one log line per request)
│   ├── dates.ts                    # Timezone-aware date utilities
│   ├── logger.ts                   # Logger: JSON lines in production, colored text in dev; adds request ID
│   ├── rate-limit.ts               # In-memory rate limiter
│   ├── unit-normalizer.ts          # Unit string normalization (50+ variations)
│   ├── sanitize.ts                 # Text input sanitization (XSS protection)
│   ├── constants.ts                # Business types, known units, thresholds
│   ├── env.ts                      # Environment variable validation
│   ├── query-client.ts             # React Query defaults
│   └── utils.ts                    # cn() utility (tailwind-merge)
├── prompts/
│   ├── parser.ts                   # NL sales parser system prompt (versioned)
│   ├── receipt-parser.ts           # Receipt line-item parser system prompt (ADR-019)
│   ├── chat.ts                     # AI chat system prompt
│   └── insights.ts                 # Insight generator system prompt
├── services/
│   ├── sales-parser.ts             # Rule-based NL parser (fallback for typed Log/NL tab)
│   ├── llm-sales-parser.ts         # Claude-powered NL parser (primary, with ambiguous detection)
│   ├── llm-receipt-parser.ts       # Claude-powered receipt line-item parser (consumes structured Textract output)
│   ├── rule-based-receipt-parser.ts # Receipt-shaped rule-based fallback (opt-in, RECEIPT_FALLBACK=structured)
│   ├── product-matcher.ts          # Fuzzy matching (Levenshtein, substring)
│   ├── prediction-engine.ts        # Demand prediction (moving avg + weekday + holidays)
│   ├── insight-generator.ts        # LLM insights with template fallback
│   ├── analytics.ts                # Trend calculations, period comparisons
│   ├── chat-context.ts             # Business data context builder for AI chat
│   └── weekly-email.ts             # Weekly summary email composer + sender
├── data/
│   └── holidays.ts                 # Public holiday data by region (AU-VIC default)
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
│   └── index.ts                    # NextAuth type extensions
└── proxy.ts                        # Route protection (replaces middleware in Next.js 16)
```


---

## 3. Data Model

The complete Prisma schema is in `packages/db/prisma/schema.prisma`, and the full field-by-field reference for every model lives in the [API Reference → Data Models](./API.md#data-models). This section records only the design decisions behind the schema:

- **Prisma v7** with `prisma-client` generator (ESM, Rust-free) and `PrismaPg` adapter
- **`@db.Date`** for sales dates — stores calendar date only, no time component
- **Business isolation** — every data table has `businessId` foreign key; all queries scoped
- **Multiple entries per day** — no unique constraint on `(businessId, date)` for SalesEntry
- **Insight dedup** — `@@unique([businessId, date, type])` on DailyInsight prevents duplicates
- **Cascade deletes** — SalesItem cascades from SalesEntry; all business data cascades from Business
- **Query indexes** — `SalesEntry (businessId, date)` serves the business-scoped date-range queries behind the dashboard, history, export, analytics, predictions, insights, chat and weekly email. `SalesItem (salesEntryId)` serves loading items for those entries. `Product` lookups by `businessId` use the `(businessId, name)` unique index. `DailyInsight` and `DemandForecast` have their own `(businessId, date)` indexes. Not indexed, on purpose: `SalesItem.productId` (only checked when a product row is deleted) and `Account`/`Session.userId` (unused with JWT sessions).
- **Migrations** — schema changes ship as Prisma migrations in `packages/db/prisma/migrations/` and are applied with `prisma migrate deploy`. `20261001000000_catch_up_schema_drift` records earlier changes that had been applied with `db push`; databases that already had them mark it as applied with `prisma migrate resolve --applied`. See [CONTRIBUTING](../CONTRIBUTING.md#database-schema-changes).

### Key Fields Added Post-MVP

| Model | Field | Purpose |
|-------|-------|---------|
| User | `isDemo` | Flags the seeded demo account; demo accounts are undeletable and password-immutable (Phase 23) |
| User | `image` | Reserved for future avatar support (currently unused) |
| Business | `timezone` | IANA timezone for date calculations (auto-detected from browser) |
| Business | `region` | Region code for holiday-aware predictions (default: AU-VIC) |
| Business | `weeklyEmailEnabled` | Opt-in flag toggled via `PATCH /api/business`; drives the recipient list of `POST /api/email/weekly-summary` |
| SalesEntry | `rawInput` | Original NL text for audit trail (also Textract `rawText` for receipt-origin entries) |
| SalesEntry | `receiptKey` | S3 object key for receipt-origin entries (nullable) |
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
Reset:      POST /api/auth/forgot-password → generate token → send email via SES (Resend fallback)
            POST /api/auth/reset-password → validate token → update password (atomic transaction)
```

### Route Protection

`apps/web/src/proxy.ts` (Next.js 16's replacement for middleware) protects all `/(app)/*` routes. Public routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify`.

### Rate Limiting

In-memory sliding window rate limiter (`apps/web/src/lib/rate-limit.ts`):
- Signup: 10 per IP per hour
- Forgot password: 3 per email per hour (silently drops excess to prevent enumeration)

---

## 5. API Contracts

The full endpoint catalogue — request/response shapes, query parameters, status codes, and error bodies for every route — lives in the [API Reference](./API.md). This section records only the cross-cutting conventions every endpoint follows.

### Conventions

- Base path: `/api/*`
- Content type: `application/json` (except CSV export)
- Auth: all routes except auth endpoints require valid session
- Business scoping: `businessId` from session, never from request body
- Success format: `{ data, meta? }` (`meta` for pagination)
- Error format: `{ error: { code, message, details? } }`
- Request ID: every API response carries an `x-request-id` header (a valid incoming one is reused)
- Status codes: 200, 201, 400, 401, 404, 409, 422, 429, 500, 503

### Request logging

Every API request produces one `request completed` log line with `method`, `path`, `status`, `durationMs` and the request ID. It's logged at `info`, `warn` (4xx) or `error` (5xx).

- **`apps/web/src/proxy.ts`** assigns the request ID for `/api/*`. It reuses a well-formed incoming `x-request-id` (letters, digits, `.`, `_`, `-`, up to 128 characters) or generates a UUID. It passes the ID to the route as a request header and returns it on the response. Requests the proxy rejects (401) are logged there with `handledBy: "proxy"`.
- **`withRequestLogging`** (`apps/web/src/lib/request-logging.ts`) wraps every route handler export. It runs the handler inside a request context, so any `logger` call made while handling the request is tagged with the same ID. It times the request and writes the summary line. An unhandled error is logged and returned as the standard 500 envelope.
- **Not logged:** query strings and request/response bodies, which can contain tokens or personal data. Only the path is logged.
- **Format:** in production (`NODE_ENV=production`) each line is a single JSON object, `{ level, timestamp, context, message, requestId?, data? }`, so CloudWatch can filter on fields (e.g. `$.data.status >= 500`). Local development keeps the colored format, with a short `[req:xxxxxxxx]` tag.

---

## 6. Core Services

### 6.1 Sales Parser — Dual Mode (ADR-003, ADR-011)

Two parsers with automatic fallback:

**LLM Parser** (`services/llm-sales-parser.ts`) — Primary
- Sends raw text + product list to Claude Haiku
- System prompt instructs structured JSON extraction with exact unit strings
- Handles conversational input ("about two dozen eggs", "maybe 30 kilos of beef")
- Detects ambiguous quantities ("few", "some", "a couple") with clarification messages
- Returns `ParsedItem[]` with `parseMethod: "llm"`, `status: "ok" | "ambiguous"`, optional `clarification`

**Unit Normalization** (`lib/unit-normalizer.ts`)
- Maps 50+ unit variations to consistent values (e.g., "Litre", "L", "liter" → "liters")
- Applied to both LLM and rule-based parser output
- Ensures consistent units stored in database regardless of input format

**Date Selection**
- Date picker above the NL/manual tabs, defaults to today, max is today
- Users can log sales for any past date they missed
- Selected date shown on the confirmation screen before saving

**Rule-Based Parser** (`services/sales-parser.ts`) — Fallback for the typed Log/NL tab only (per ADR-019)
- Tokenizes by commas and "and"
- Extracts quantity (number), unit (word-boundary regex), product name (remainder)
- Fuzzy matches against product catalog via `product-matcher.ts`
- Handles: "a dozen" → 12, "half kg" → 0.5, duplicate merging
- Unit regex uses word boundaries to avoid matching inside product names
- **Not** used as the receipt-path fallback — receipts are too noisy for chat-style tokenization to produce usable output. The receipt path uses the structured rule-based parser below, opt-in only.

**Product Matcher** (`services/product-matcher.ts`)
- Priority: exact → normalized (strip plural) → substring → Levenshtein (≤2) → unmatched

### 6.2 Prediction Engine (ADR-006, ADR-015)

`services/prediction-engine.ts` — Statistical demand prediction with holiday awareness.

**Algorithm:** Weighted blend of weekday pattern (60%) + recent trend (40%), then holiday multiplier applied.
- Weekday signal: average of last 4 same-weekday occurrences
- Recent signal: average of last 7 days
- Holiday multiplier: closed (0.3), low (0.6), pre-holiday (1.2), post-holiday (1.1)
- Confidence: based on data volume (5/15/30 thresholds) adjusted by coefficient of variation
- Minimum: 5 sales entries before predictions activate
- Time horizons: next day + next 7 days
- Region-based holiday data from `apps/web/src/data/holidays.ts`

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

### 6.6 Receipt Parser (ADR-019)

Two parsers, both consuming AWS Textract `AnalyzeExpense` output (structured `LineItems` with separate description, quantity, unit price, and total fields). The chat-style `sales-parser.ts` is **not** in this pipeline — see ADR-019 for why.

**Textract wrapper** (`lib/textract.ts`)
- `extractReceiptFromS3(bucket, key)` runs `AnalyzeExpenseCommand` against an S3-hosted image and returns `{ lineItems: ReceiptLineItem[], rawText: string }`
- `mapAnalyzeExpenseResponse(response)` is a pure mapping helper exported for unit tests
- Field extraction filters `Type.Text` values: `ITEM`, `QUANTITY`, `UNIT_PRICE`, `PRICE`, `EXPENSE_ROW`

**LLM Receipt Parser** (`services/llm-receipt-parser.ts`) — Primary
- Sends structured line items + product list to Claude with `RECEIPT_PARSER_SYSTEM_PROMPT` (`prompts/receipt-parser.ts`)
- Claude resolves abbreviations (`MNCD` → `Minced`, `CHKN BRST` → `Chicken Breast`, `FR` → `Free Range`), infers units from suffixes (`500G` → `g`, `12PK` → `packs`), and filters obvious non-sales rows
- Returns `null` on API failure so the route can decide between 503 and structured fallback

**Structured Rule-Based Parser** (`services/rule-based-receipt-parser.ts`) — Opt-in fallback
- Gated by `RECEIPT_FALLBACK=structured` env var (off by default per ADR-019)
- Per line item: filter via `NOISE_DESCRIPTION` regex (`TOTAL|GST|EFTPOS|...`), run `matchProduct(description, products)`, infer unit via `inferUnitFromDescription`, use AWS-provided quantity verbatim (default to 1 if absent)
- Distinct from the chat-style `sales-parser.ts` — bypasses tokenization, quantity-extraction, and unit-extraction entirely (those steps are what broke on raw receipt text)

**Route** (`/api/receipts/parse`)
- LLM first → if null and `RECEIPT_FALLBACK=structured`, structured rule-based → otherwise 503 (`SERVICE_UNAVAILABLE`) with a user-facing pointer to the typed Log/NL tab
- Response always includes the AWS-structured `lineItems` alongside the matched `parsed` items (transparency + future reconciliation flows)

### 6.7 Weekly Summary Email

`services/weekly-email.ts` composes a per-business weekly digest (last week's totals + week-ahead forecast) and sends via `lib/email.ts` (SES primary, Resend fallback). Triggered by `POST /api/email/weekly-summary`, which fans out across every business with `weeklyEmailEnabled: true`.

**Status: not operational (paused).** No scheduler invokes the route, and the Settings toggle is hidden until the feature is rebuilt.
- The route sits behind the session check in `apps/web/src/proxy.ts`, which rejects scheduler calls (no login cookie) before the route's own bearer check runs. Neither the EventBridge rule nor the Vercel Cron mirror ever reached it.
- The legacy EventBridge setup (a scheduled rule targeting an API destination, plus a connection holding `Authorization: Bearer <CRON_SECRET>`) had a deauthorized connection with a pre-rotation secret. It has been removed.
- Planned redesign (#42, Stage 4f): EventBridge Scheduler (hourly, IAM-authorized, defined in code) → SQS (one message per business, with a dead-letter queue and alarm) → a NestJS worker. Each business is sent at its local Monday 07:00, guarded by a unique `(businessId, isoWeek)` sent record so retries can't double-send.

The route never throws on per-business failure; it logs and continues, returning a `{ sent, failed, total }` summary so a single bad recipient doesn't block the rest.

### 6.8 Date Utilities (ADR-013)

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

### 7.3 Dashboard Components

- Prediction progress bar (4 tiers: 0–4 / 5–14 / 15–29 / 30+, auto-hides at 30+)
- Tomorrow's forecast card with holiday indicator
- Demand spike alert card (>30% above average)
- Today's summary, week trend with bar chart, top products, insights
- Weekly forecast with per-day breakdown

### 7.4 Auth Pages

- Show/hide password toggle (`PasswordInput` component)
- Email verification status in settings with resend option
- Branded splash screen on initial load (app icon, warm cream background)
- Per-page loading skeletons (dashboard, chat, settings, sales, products)

### 7.5 i18n

- Library: `next-intl` with Next.js 16 plugin
- ~150 translation keys in `apps/web/src/messages/en.json`
- 8 namespaces: common, auth, onboarding, dashboard, sales, products, predictions, nav
- Adding a language: create `apps/web/src/messages/{locale}.json`, update `apps/web/src/i18n/request.ts`

### 7.6 PWA

- `apps/web/src/app/manifest.ts` — app name, warm theme, standalone display, start URL `/dashboard`
- `public/sw.js` — network-first service worker with offline fallback
- `apps/web/src/app/offline/page.tsx` — "You're offline" page
- Icons: 192x192, 512x512, 512x512 maskable, apple-touch-icon

---

## 8. Security

- Passwords: bcrypt cost factor 12
- Sessions: JWT via Auth.js (7-day expiry)
- CSRF: Auth.js built-in
- Rate limiting: in-memory sliding window on auth endpoints (signup 10/IP/hr, forgot-password 3/email/hr), AI chat (20/hr), and `/api/sales/parse` (30/hr) per Phase 23
- Input validation: Zod schemas on all API inputs
- Input sanitization: `apps/web/src/lib/sanitize.ts` strips control chars + clamps length on user-facing text (business name, product name)
- SQL injection: Prisma parameterized queries
- XSS: React default escaping + sanitization above
- Data isolation: every query scoped to `businessId` from session
- Product ownership: verified before creating SalesItems
- Timezone validation: IANA string validated server-side via `Intl.DateTimeFormat`
- Atomic operations: sales updates wrapped in `$transaction`
- Token security: password reset tokens deleted atomically before password update
- Server-only guards: every lib module that reads secrets carries `import "server-only"` so accidental client imports fail the build (per ADR-017)
- Cron auth: weekly summary route requires `Bearer <CRON_SECRET>` matching the value resolved by `getSecret()` (env→Secrets Manager)
- Demo account: undeletable and password-immutable (`User.isDemo`)

---

## 9. External Services

| Service | Purpose | Cost |
|---------|---------|------|
| Neon | PostgreSQL (serverless) | Free tier |
| AWS Amplify | Hosting + deployment (primary) | Free tier (build minutes + SSR Lambda invocations) |
| Anthropic (Claude Haiku 4.5) | NL parsing, insights, chat, receipt mapping | ~$1-5/month at moderate usage |
| Amazon SES | Primary email delivery (auth + weekly summary) | Free tier (sandbox mode: verified recipients only) |
| Amazon EventBridge | Weekly summary scheduler (removed; rebuild planned in #42) | n/a |
| Amazon S3 | Receipt image storage (presigned PUT) | Pennies/month at expected receipt volumes |
| Amazon Textract `AnalyzeExpense` | Structured receipt OCR | ~$0.01/page (≈10× `DetectDocumentText`); pennies/business/month at expected receipt volumes |
| AWS Secrets Manager | Vendor API keys + cron secret (3 secrets) | ~$0.40/month/secret + per-call charges |
| Resend | Fallback email delivery | Free tier (3000/month) |
| Sentry | Error tracking (SDK initialization fix pending, #68) | Free developer tier |

---

## 10. Environment Variables

Locally, the web app reads `apps/web/.env` and Prisma commands read `packages/db/.env` (only `DATABASE_URL`). In production, Amplify writes allowlisted variables to `apps/web/.env.production` at build time (see below).

### Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Auth.js session encryption key |
| `AUTH_URL` | Yes | Application URL (e.g., `https://freshcast.site`) |
| `ANTHROPIC_API_KEY` | No | Claude API key (LLM features degrade gracefully without it) |
| `APP_AWS_REGION` | No | Preferred AWS region variable (use when `AWS_*` is reserved by hosting platform) |
| `APP_AWS_ACCESS_KEY_ID` | No | Preferred AWS access key variable |
| `APP_AWS_SECRET_ACCESS_KEY` | No | Preferred AWS secret key variable |
| `AWS_REGION` | No | Backward-compatible fallback region variable |
| `AWS_ACCESS_KEY_ID` | No | Backward-compatible fallback access key variable |
| `AWS_SECRET_ACCESS_KEY` | No | Backward-compatible fallback secret key variable |
| `SES_FROM_EMAIL` | No | Verified sender email for SES |
| `S3_RECEIPTS_BUCKET` | No | S3 bucket for receipt image uploads and OCR parsing |
| `RECEIPT_UPLOAD_ENABLED` | No | Set to `true` to enable receipt photo upload and parsing. Off by default: when unset, the Log page hides the upload button and both receipt endpoints return `503 FEATURE_DISABLED`. To enable in production it must also be added to the `amplify.yml` env allowlist (ADR-017). |
| `RESEND_API_KEY` | No | Fallback provider API key (used when SES is unavailable) |
| `CRON_SECRET` | No | Shared secret for invoking cron-triggered routes (e.g. weekly summary) |
| `RECEIPT_FALLBACK` | No | Set to `structured` to enable the structured rule-based fallback on `/api/receipts/parse` when the LLM is unavailable. Off by default per ADR-019 — see Phase 32.1.3 for the broader feature-flag plan. |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry DSN — intentionally exposed to the browser; the only `NEXT_PUBLIC_*` value in the app |

### Loading mechanism (Amplify SSR)

Per **ADR-017**, no environment variables are listed under `next.config.ts` `env` — that field inlines literals into the JavaScript bundle regardless of `NEXT_PUBLIC_` semantics, which historically leaked server secrets into the browser.

Amplify Hosting injects Console env vars into the **build container** but does not propagate them to the **SSR Lambda**. To bridge the gap, `amplify.yml` writes the relevant Console vars into `.env.production` immediately before `next build`, where Next.js's native `.env` loader picks them up for both the build and the SSR runtime. Server-only vars stay server-side; only `NEXT_PUBLIC_*` cross into the client bundle.

Server-only modules that read secret env vars (`apps/web/src/lib/{prisma,env,email,ses,claude,s3,aws-config,secrets}.ts`) carry an `import "server-only"` guard so that any future client-side import fails the build instead of silently leaking values into a client chunk.

### Secrets Manager (hybrid resolver)

Per **ADR-018**, three secrets are sourced from **AWS Secrets Manager** at runtime via `apps/web/src/lib/secrets.ts`:

| SM secret ID | Reads as env | Consumer |
|---|---|---|
| `freshcast/anthropic-api-key` | `ANTHROPIC_API_KEY` | `apps/web/src/lib/claude.ts` |
| `freshcast/resend-api-key` | `RESEND_API_KEY` | `apps/web/src/lib/email.ts` |
| `freshcast/cron-secret` | `CRON_SECRET` | `apps/web/src/app/api/email/weekly-summary/route.ts` |

Resolution order is **env first, SM second**: when the env var is set the resolver returns it without touching SM (used by local dev, preview branches, and as a manual rollback). When unset, SM is fetched once per warm Lambda container and cached for the rest of its lifetime. On SM error the resolver returns `null` so callers degrade gracefully (chat skipped, weekly-summary route returns 401 if no secret is resolved).

`DATABASE_URL` and `AUTH_SECRET` are explicit carve-outs and stay in `.env.production` due to Prisma's synchronous client construction and Auth.js's package-init env read, respectively. See ADR-018 for the full rationale and the cutover sequence (env entries are removed from Amplify Console + `amplify.yml` per-secret, after verifying each SM path works in production).

The Amplify SSR Lambda execution role has a least-privilege inline policy granting `secretsmanager:GetSecretValue` on those three specific secret ARNs only.

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
| Holidays | Region-based holiday multipliers on predictions | 015 |
| Editorial rebrand | Warm palette, serif headings | 016 |
| Env on Amplify | No `next.config` `env`; route via `amplify.yml` → `.env.production` | 017 |
| Secrets at runtime | Hybrid env→Secrets Manager resolver for vendor API keys and cron secret | 018 |
| Receipt OCR fallback | LLM-only by default; Textract migrated to `AnalyzeExpense`; structured rule-based fallback opt-in via `RECEIPT_FALLBACK=structured` | 019 |
| Backend architecture | Dedicated NestJS API, migrated incrementally; monorepo with `@freshcast/db` and `@freshcast/shared` | 020 |
| API hosting & infrastructure | ECS Fargate + ALB (rolling deploys, circuit breaker); AWS CDK in `infra/`; CDK references the existing Route 53 zone | 021 |

---

## 12. Build and Deployment

### 12.1 Workspace and task graph

The repo is a pnpm workspace (`apps/*`, `packages/*`) with Turborepo (`turbo.json`). Root scripts run each task across all packages:

| Task | What runs | Order |
|---|---|---|
| `build` | `@freshcast/db`: `prisma generate && tsc` · `@freshcast/shared`: `tsc` · `@freshcast/web`: `next build && node scripts/materialize-next-aliases.mjs` | Dependencies first (`^build`) |
| `lint`, `typecheck`, `test`, `dev` | Per package | After dependencies are built |

- **Compiled packages:** both packages compile to `dist/`, with `exports` pointing types at `apps/web/src/` and runtime at `dist/`.
- **Caching:** Turborepo caches task outputs (`.next/**`, `dist/**`, and the generated Prisma client), so unchanged packages are skipped.
- **Environment mode:** `envMode: loose` passes the full environment to tasks, as plain `next build` did. `.env*` files count as build inputs.

### 12.2 CI and branch rules

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request and push to `main`: frozen `pnpm install`, then `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` with placeholder env values. The build checks that env vars exist when routes load but never connects to the database.

A repository ruleset protects `main`: changes arrive through pull requests, the CI `check` job must pass, and force-pushes and branch deletion are blocked.

### 12.3 AWS Amplify (production)

`amplify.yml` uses Amplify's monorepo format:
- **`appRoot: apps/web`.** The Amplify environment variable `AMPLIFY_MONOREPO_APP_ROOT=apps/web` (all branches) must match it.
- **`buildPath: /`,** so the workspace installs and builds from the repo root.
- **Node 24** via `nvm install 24 --skip-default-packages`, then `corepack enable` and `pnpm install --frozen-lockfile`.
- **Hoisted `node_modules`** (`nodeLinker: hoisted`, mirrored in `.npmrc`). Amplify's SSR runtime can't load pnpm's default symlinked layout.
- **Allowlisted env vars** are written to `apps/web/.env.production` before the build (ADR-017).
- **Build:** `pnpm turbo run build --filter=@freshcast/web`; artifacts come from `apps/web/.next`.

**Post-build alias step:** Turbopack externalizes some packages (`@prisma/client`, `pg`, `@aws-sdk/client-s3`, OpenTelemetry hooks) through hashed alias symlinks in `.next/node_modules`, with relative targets sized for the `apps/web` depth. Amplify deploys the app root flattened to `/var/task`, which breaks those links: in #67, every route using these packages failed to load. `scripts/materialize-next-aliases.mjs` replaces the links with real copies, and the build fails if any remain. Recheck it on Next.js upgrades.

### 12.4 Preview branches

Changes to the build, package layout or deployment config are deployed to an **Amplify preview branch** before merging, because local runs don't reproduce Amplify's runtime layout:
1. **Connect the feature branch** in Amplify. It gets its own URL, `https://<branch>.<app-id>.amplifyapp.com`.
2. **Set branch-only overrides:** `DATABASE_URL` points at a **dev Neon branch** (never production data), and `AUTH_URL` is the preview URL.
3. **Turn on access control** (a password) for the branch.
4. **Verify:** the `/api/auth/*` endpoints return JSON, then a logged-in click-through.
5. **After merging,** disconnect the preview branch.

Ordinary code changes don't need a preview; CI covers them.

### 12.5 Rollback and migrations

- **Rollback:** Amplify's "Redeploy this version" **rebuilds** that commit with the current environment variables. A commit from before the monorepo needs `AMPLIFY_MONOREPO_APP_ROOT` removed first.
- **Production migrations** are a separate, deliberate step, never part of the build: `pnpm --filter @freshcast/db migrate:deploy`, with the production `DATABASE_URL` set for that command only. Schema changes go through migrations, never `db push` (see CONTRIBUTING).
