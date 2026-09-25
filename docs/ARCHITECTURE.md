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
│       Next.js SSR (AWS Amplify primary, Vercel mirror)│
│  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │  App Router   │  │   API Routes (/api/*)        │ │
│  │  (SSR/RSC)    │  │   REST endpoints             │ │
│  └──────────────┘  └──────────┬───────────────────┘ │
│                                │                     │
│  ┌──────────────┐  ┌──────────▼───────────────────┐ │
│  │   Auth.js v5  │  │   Business Logic Services    │ │
│  │  (JWT)        │  │   Parser · Receipt parser ·  │ │
│  └──────┬───────┘  │   Analytics · Predictions ·  │ │
│         │          │   Insights · Chat Context ·  │ │
│         │          │   Weekly Email               │ │
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
│    Insights · NL Parsing · Receipt mapping · AI Chat  │
│    Fallback: templates (insights), rule-based (NL),   │
│    503 (receipts — see ADR-019)                       │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│    AWS                                                │
│    SES — auth + weekly summary email (Resend fallback)│
│    EventBridge — weekly summary scheduler             │
│    S3 — receipt image storage (presigned PUT)         │
│    Textract `AnalyzeExpense` — structured receipt OCR │
│    Secrets Manager — Anthropic, Resend, cron secret   │
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
│   │   │   └── weekly-summary/route.ts  # POST (cron-triggered, EventBridge primary / Vercel Cron mirror)
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
│   ├── api-helpers.ts              # errorResponse, getBusinessId, getBusinessContext
│   ├── dates.ts                    # Timezone-aware date utilities
│   ├── logger.ts                   # Structured logging (color-coded, timestamped)
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
│   └── index.ts                    # NextAuth type extensions, ParsedItem
└── proxy.ts                        # Route protection (replaces middleware in Next.js 16)
```


---

## 3. Data Model

The complete Prisma schema is in `prisma/schema.prisma`, and the full field-by-field reference for every model lives in the [API Reference → Data Models](./API.md#data-models). This section records only the design decisions behind the schema:

- **Prisma v7** with `prisma-client` generator (ESM, Rust-free) and `PrismaPg` adapter
- **`@db.Date`** for sales dates — stores calendar date only, no time component
- **Business isolation** — every data table has `businessId` foreign key; all queries scoped
- **Multiple entries per day** — no unique constraint on `(businessId, date)` for SalesEntry
- **Insight dedup** — `@@unique([businessId, date, type])` on DailyInsight prevents duplicates
- **Cascade deletes** — SalesItem cascades from SalesEntry; all business data cascades from Business

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

`src/proxy.ts` (Next.js 16's replacement for middleware) protects all `/(app)/*` routes. Public routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify`.

### Rate Limiting

In-memory sliding window rate limiter (`src/lib/rate-limit.ts`):
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
- Error format: `{ error: { code, message, details? } }`
- Status codes: 200, 201, 400, 401, 404, 409, 422, 429, 500, 503

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
- Region-based holiday data from `src/data/holidays.ts`

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

**Scheduling**
- Production: Amazon EventBridge invokes the route weekly with `Authorization: Bearer <CRON_SECRET>`
- Mirror: Vercel Cron invokes the same route on the Vercel deployment as a safety net
- Manual: operators can `curl` the route with the same bearer token for backfills

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
- ~150 translation keys in `src/messages/en.json`
- 8 namespaces: common, auth, onboarding, dashboard, sales, products, predictions, nav
- Adding a language: create `src/messages/{locale}.json`, update `src/i18n/request.ts`

### 7.6 PWA

- `src/app/manifest.ts` — app name, warm theme, standalone display, start URL `/dashboard`
- `public/sw.js` — network-first service worker with offline fallback
- `src/app/offline/page.tsx` — "You're offline" page
- Icons: 192x192, 512x512, 512x512 maskable, apple-touch-icon

---

## 8. Security

- Passwords: bcrypt cost factor 12
- Sessions: JWT via Auth.js (7-day expiry)
- CSRF: Auth.js built-in
- Rate limiting: in-memory sliding window on auth endpoints (signup 10/IP/hr, forgot-password 3/email/hr), AI chat (20/hr), and `/api/sales/parse` (30/hr) per Phase 23
- Input validation: Zod schemas on all API inputs
- Input sanitization: `src/lib/sanitize.ts` strips control chars + clamps length on user-facing text (business name, product name)
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
| Vercel | Hosting + deployment (mirror) | Free tier |
| Anthropic (Claude Haiku 4.5) | NL parsing, insights, chat, receipt mapping | ~$1-5/month at moderate usage |
| Amazon SES | Primary email delivery (auth + weekly summary) | Free tier (sandbox mode: verified recipients only) |
| Amazon EventBridge | Weekly summary scheduler | Free tier (under 14M scheduled invocations/month) |
| Amazon S3 | Receipt image storage (presigned PUT) | Pennies/month at expected receipt volumes |
| Amazon Textract `AnalyzeExpense` | Structured receipt OCR | ~$0.01/page (≈10× `DetectDocumentText`); pennies/business/month at expected receipt volumes |
| AWS Secrets Manager | Vendor API keys + cron secret (3 secrets) | ~$0.40/month/secret + per-call charges |
| Resend | Fallback email delivery | Free tier (3000/month) |
| Sentry | Error tracking | Free developer tier |

---

## 10. Environment Variables

### Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Auth.js session encryption key |
| `AUTH_URL` | Yes | Application URL (e.g., `https://freshcast.vercel.app`) |
| `ANTHROPIC_API_KEY` | No | Claude API key (LLM features degrade gracefully without it) |
| `APP_AWS_REGION` | No | Preferred AWS region variable (use when `AWS_*` is reserved by hosting platform) |
| `APP_AWS_ACCESS_KEY_ID` | No | Preferred AWS access key variable |
| `APP_AWS_SECRET_ACCESS_KEY` | No | Preferred AWS secret key variable |
| `AWS_REGION` | No | Backward-compatible fallback region variable |
| `AWS_ACCESS_KEY_ID` | No | Backward-compatible fallback access key variable |
| `AWS_SECRET_ACCESS_KEY` | No | Backward-compatible fallback secret key variable |
| `SES_FROM_EMAIL` | No | Verified sender email for SES |
| `S3_RECEIPTS_BUCKET` | No | S3 bucket for receipt image uploads and OCR parsing |
| `RESEND_API_KEY` | No | Fallback provider API key (used when SES is unavailable) |
| `CRON_SECRET` | No | Shared secret for invoking cron-triggered routes (e.g. weekly summary) |
| `RECEIPT_FALLBACK` | No | Set to `structured` to enable the structured rule-based fallback on `/api/receipts/parse` when the LLM is unavailable. Off by default per ADR-019 — see Phase 32.1.3 for the broader feature-flag plan. |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry DSN — intentionally exposed to the browser; the only `NEXT_PUBLIC_*` value in the app |

### Loading mechanism (Amplify SSR)

Per **ADR-017**, no environment variables are listed under `next.config.ts` `env` — that field inlines literals into the JavaScript bundle regardless of `NEXT_PUBLIC_` semantics, which historically leaked server secrets into the browser.

Amplify Hosting injects Console env vars into the **build container** but does not propagate them to the **SSR Lambda**. To bridge the gap, `amplify.yml` writes the relevant Console vars into `.env.production` immediately before `next build`, where Next.js's native `.env` loader picks them up for both the build and the SSR runtime. Server-only vars stay server-side; only `NEXT_PUBLIC_*` cross into the client bundle.

Server-only modules that read secret env vars (`src/lib/{prisma,env,email,ses,claude,s3,aws-config,secrets}.ts`) carry an `import "server-only"` guard so that any future client-side import fails the build instead of silently leaking values into a client chunk.

### Secrets Manager (hybrid resolver)

Per **ADR-018**, three secrets are sourced from **AWS Secrets Manager** at runtime via `src/lib/secrets.ts`:

| SM secret ID | Reads as env | Consumer |
|---|---|---|
| `freshcast/anthropic-api-key` | `ANTHROPIC_API_KEY` | `src/lib/claude.ts` |
| `freshcast/resend-api-key` | `RESEND_API_KEY` | `src/lib/email.ts` |
| `freshcast/cron-secret` | `CRON_SECRET` | `src/app/api/email/weekly-summary/route.ts` |

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
