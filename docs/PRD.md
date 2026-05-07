# Freshcast — Product Requirements Document (PRD)

> **How to read this document.** This PRD is a living document describing the Freshcast product as it currently exists, plus the principles and non-goals that should guide future changes. Historical decisions live in [`docs/adr/`](./adr/README.md); shipped behaviour by release lives in [`CHANGELOG.md`](../CHANGELOG.md); phase-by-phase delivery lives in [`docs/IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md). Update this document when product scope, requirements, or non-goals change.

## 1. Overview

### Product Summary

Freshcast is a mobile-first AI assistant for small retail businesses that helps owners quickly log daily sales and receive actionable insights, trends, and demand predictions — without requiring complex inventory or POS systems. It runs as an installable PWA, accepts sales as typed natural language, manual form input, or photographed receipts, and uses Claude Haiku to keep the input experience forgiving and the dashboard insights conversational.

### Problem Statement

Small business owners (market vendors, butchers, cafés, grocery stores) face a common set of challenges:

- They don't use advanced business tools because they're too complex
- They lack visibility into sales trends and performance
- They rely on intuition rather than data for stocking decisions
- They waste stock or miss sales opportunities due to poor demand estimation

Existing solutions (POS/ERP systems) are too complex, require heavy setup, and aren't tailored for small operators.

### Solution

Freshcast provides:

- Three input modes for sales — natural language, manual form, or receipt photo (OCR-extracted)
- Quantity-focused demand prediction with weekday + recent-trend blending and holiday-aware adjustments (core differentiator)
- Lightweight trend analysis and AI-generated business insights, cached daily and refreshed on dashboard open
- Proactive next-day forecast on the dashboard with demand spike alerts
- An AI chat assistant grounded in the user's own data
- An opt-in weekly summary email with the week's totals and the week-ahead forecast

All without requiring full inventory, catalog setup, or ERP integration. Price/revenue tracking is intentionally out of scope (see §4).

---

## 2. Goals & Success Metrics

### Goals

1. Reduce friction in daily sales tracking to near-zero
2. Provide meaningful quantity-based insights within 7 days of usage
3. Help users make better stocking decisions through demand prediction
4. Create a product users return to daily

### Success Metrics

| Metric | Target |
|---|---|
| Sales logging time | < 30 seconds per entry |
| Onboarding completion time | < 2 minutes |
| Return visits in first week | ≥ 3 |
| Dashboard shows meaningful insights | After 5–7 entries |
| User engages with predictions | At least once in first week |

---

## 3. Target Users

### Primary Users

- Small retail vendors
- Butchers / fresh produce sellers
- Market stall operators
- Small grocery / specialty stores
- Cafés / takeaway owners

### User Characteristics

- Limited time during business hours
- Low tolerance for complex systems
- Moderate digital literacy
- Already track sales informally (mentally or on paper)
- Plan stock the night before or early morning

---

## 4. Non-Goals

Freshcast intentionally does NOT:

- Replace POS systems
- Manage inventory lifecycle
- Handle suppliers or purchase orders
- Require full product catalog setup
- Provide cross-business comparisons or competitor insights
- Track pricing or revenue (quantity-only by design)

---

## 5. Product Principles

1. **Low friction over completeness** — speed of input matters more than capturing every detail
2. **Insight over data entry** — the value is in what users learn, not what they type
3. **Mobile-first experience** — designed for one-handed use during a busy day
4. **Private, business-specific intelligence** — each business's data is isolated
5. **AI as assistant, not replacement** — augments decisions, doesn't make them
6. **Choice in interaction** — users pick the input method that suits them

---

## 6. Core Features

### 6.1 Authentication

**Description:** Simple account creation and login, one account per business.

**Approach:** Email/password authentication with password reset (token-based, email delivery via Amazon SES with Resend fallback). Optional email verification on signup.

**Requirements:**
- Sign up with email and password
- Login with email/password
- Password reset flow (email with reset link, token deleted atomically before password update)
- Email verification (optional, sent on signup, resendable from settings, status shown there)
- Show/hide password toggle on all password fields
- Session persistence via JWT (7-day expiry)
- One account = one business (no multi-user support)
- Rate limiting on signup (10/IP/hr) and forgot-password (3/email/hr, silently drops excess to prevent enumeration)
- Demo account is undeletable and password-immutable (`User.isDemo`)

**Out of scope (today):** magic link, social login, MFA, multi-user / role-based access. See `docs/BACKLOG.md` for candidates.

---

### 6.2 Onboarding

**Description:** Minimal onboarding to get users started quickly.

**Requirements:**
- 3-step wizard:
  - Step 1: Business name + type (tile selector — Retail Vendor, Butcher, Produce Seller, Market Stall, Grocery, Café, Takeaway, Other)
  - Step 2: 3–5 core products (free text + optional default unit)
  - Step 3: Locale preference (default `"en"`); timezone auto-detected from the browser and validated server-side as a real IANA identifier
- Region defaults to `AU-VIC` for holiday-aware predictions; can be changed in settings later
- After completion, user lands on `/dashboard` with empty-state guidance

**Constraints:**
- Must complete in < 2 minutes
- No full catalog required — products grow organically as sales are logged

---

### 6.3 Sales Input — Three Modes

**Description:** Users log daily sales through whichever input mode suits the moment. All three modes route into the same confirmation screen and the same persistence path.

#### Mode A: Natural Language

A large text input field where users type sales in plain language.

**Example inputs:**
- "Sold 20 eggs, 30kg minced beef, and 10 milk bottles"
- "12 chickens, 5kg lamb"

**Functional Requirements:**
- LLM-primary (Claude Haiku) with rule-based fallback (`services/sales-parser.ts`)
- Unit normalization across both paths (e.g., "Litre", "L", "liter" all become `"liters"`); 50+ variations mapped
- Ambiguous quantity detection ("few eggs", "a couple") with a clarification prompt before saving
- Business-type-aware placeholder text (a butcher sees beef/chicken examples; a café sees coffee/sandwich examples)
- Date picker above the tabs — defaults to today, max is today, lets users backfill missed days
- Editable parsed results on the confirmation screen, including inline product-name editing for new (unmatched) items

#### Mode B: Manual Form

A structured form listing the user's existing products, with quantity steppers and optional unit selectors.

**Functional Requirements:**
- Lists all active products from the catalogue
- Inline "Add new product" option (with unit normalization on save)
- Same confirmation screen as Mode A

#### Mode C: Receipt Photo (Receipt OCR)

User uploads a photo of a supplier or POS receipt; the system extracts line items via Amazon Textract `AnalyzeExpense`, the LLM maps them to known products, and the user confirms before saving.

**Functional Requirements:**
- Presigned S3 upload (no image data flows through the SSR Lambda)
- Textract `AnalyzeExpense` returns pre-structured line items (description, quantity, unit price, total) — see [ADR-019](./adr/019-receipt-ocr-hardening.md)
- Receipt-specific LLM prompt resolves abbreviations (`MNCD BEEF` → `Minced Beef`, `CHKN BRST` → `Chicken Breast`, `FR EGGS 12PK` → `Free Range Eggs` with unit `packs`)
- Original `receiptKey` (S3 object key) is persisted on the resulting `SalesEntry` for audit
- Sales history shows a "From receipt" badge for OCR-origin entries
- When the LLM is unavailable on this path, the route returns a clear 503 pointing the user to the typed Log/NL tab; the chat-style rule-based parser is **not** used as the receipt-path fallback (per ADR-019). An opt-in structured rule-based fallback exists (`RECEIPT_FALLBACK=structured`) for graceful-degradation windows during sustained outages.

**UX (all modes):**
- All three modes accessible from the same screen (tab toggle)
- Mode A is the default/promoted mode
- Every parsed item on the confirmation screen has a remove (×) button regardless of match status

---

### 6.4 AI-Assisted Product Expansion

**Description:** The product list grows organically as users log sales rather than requiring upfront catalogue setup.

**Behavior:**
- Fuzzy-match input against the catalogue (exact → normalized plural → substring → Levenshtein ≤2 → unmatched)
- Unmatched items are flagged on the confirmation screen with an "Add" button to promote them to the catalogue
- Default unit is suggested based on the parsed unit (or inferred from receipt suffixes like `500G` → `g`)
- Product names can be edited inline on the confirmation screen before saving

---

### 6.5 Sales Logging & Storage

**Description:** Structured storage of daily sales data.

**Data Captured:** Date · Product · Quantity · Unit (optional) · Input method (`NATURAL_LANGUAGE | MANUAL`) · `rawInput` (original NL or Textract `rawText`) · `receiptKey` (S3 key for OCR-origin entries)

**Requirements:**
- Multiple entries per day (morning + afternoon, etc.) — no unique constraint on `(businessId, date)` per [ADR-014](./adr/014-multiple-daily-entries.md)
- Date picker for past-date entries (max: today)
- Edit today's entries (atomic transaction, timezone-aware per [ADR-013](./adr/013-timezone-aware-dates.md))
- Delete any entry (cascade to items via DB)
- View history (list view grouped by date with timestamps; "From receipt" badge for OCR entries)
- CSV export of sales history

---

### 6.6 Dashboard (Home Screen)

**Description:** The primary screen users see after login.

**Sections:**

| Section | Content |
|---|---|
| Tomorrow's Forecast | Per-product predictions with sparklines and trend %, holiday-adjusted; proactive and always visible |
| Demand Spike Alert | Surfaced when tomorrow's forecast is >30% above average for any product |
| Today's Summary | Products sold today, aggregated across all entries for today |
| Week Rhythm | 7-day bar chart with peak-day highlight |
| Top Products | Top 3 by quantity with coloured progress bars |
| AI Insights | 3–5 LLM-generated headline + description pairs, cached daily, fallback to template insights |
| Prediction Progress | Multi-tier progress bar (0–4 / 5–14 / 15–29 / 30+); auto-hides at 30+ entries |
| Forecast Detail | Drill-in screen with 14-day chart and per-prediction breakdown |

**Behaviour:**
- Aggregated single-call API (`GET /api/dashboard`) avoids waterfall fetches on a slow connection
- Card-based layout, single-column on mobile
- React Query handles refresh on focus and on save

---

### 6.7 Demand Prediction

**Description:** Suggest expected demand for upcoming periods to help stocking decisions.

**Time Horizons:**

1. **Next Day Forecast** — "You may need ~25 eggs tomorrow"
   - Most actionable; vendors prep stock the night before
   - Shown proactively on dashboard
2. **Next Week Overview** — per-day breakdown for the next 7 days
   - Planning view for bulk purchasing

**Algorithm (per [ADR-006](./adr/006-demand-prediction-approach.md) + [ADR-015](./adr/015-holiday-aware-predictions.md)):**
- Weighted blend of weekday pattern (60%) + recent trend (40%)
- Weekday signal: average of the last 4 same-weekday occurrences
- Recent signal: average of the last 7 days
- Holiday multiplier applied last: closed (0.3), low (0.6), pre-holiday (1.2), post-holiday (1.1)
- Confidence scoring derived from data volume (5/15/30 thresholds) adjusted by coefficient of variation
- Holiday data is region-based, default `AU-VIC`, sourced from `src/data/holidays.ts`

**Minimum Data:** predictions activate at 5+ entries; quality improves at 15 and 30. The prediction progress bar communicates this until 30+ entries.

---

### 6.8 AI Insights (Auto-Generated)

**Description:** Automatically generated business insights shown on the dashboard.

**Example Insights:**
- "Egg sales increased 15% this week"
- "Milk sales dropped compared to last week"
- "Your top 3 products account for 70% of total quantity sold"
- "Wednesday is your slowest day"

**Requirements:**
- LLM-primary (Claude Haiku) with five template fallback types: TREND, COMPARISON, TOP_PRODUCTS, weekly SUMMARY, weekday SUMMARY
- Generated once per business per day; `@@unique([businessId, date, type])` prevents duplicates on concurrent requests
- Cached in `DailyInsight`; `generationMethod` records `"llm"` or `"template"` for observability
- Refreshed when the dashboard detects stale data (>24h)
- Constrained to the user's own data — no benchmarking or cross-business inference

---

### 6.9 AI Chat

**Description:** Users can ask business-related questions in natural language and get answers grounded in their own data ([ADR-012](./adr/012-ai-chat-implemented.md)).

**Example Queries:**
- "What sold best this week?"
- "When should I prepare more chicken?"
- "How are my sales trending?"

**Requirements:**
- Responses constrained to the user's own data via a structured context block (`services/chat-context.ts`) — today's sales, weekly totals by product, previous week comparison, weekday patterns, product list
- Suggested starter questions for discoverability
- Conversation history within session (last 8 messages, ephemeral — no persistence)
- Rate-limited (20/hr per business) per [ADR-011](./adr/011-llm-integration-claude.md) cost guidance
- Graceful fallback when the LLM is unavailable

---

### 6.10 Weekly Summary Email (Opt-In)

**Description:** A weekly digest email with last week's totals and the week-ahead forecast, sent to businesses that opt in.

**Requirements:**
- Toggle in settings (`PATCH /api/business { weeklyEmailEnabled }`)
- Sent via Amazon SES (primary) with Resend fallback
- Scheduled by Amazon EventBridge (production) with Vercel Cron as a mirror
- Cron auth via `Bearer <CRON_SECRET>` (resolved env→Secrets Manager per [ADR-018](./adr/018-secrets-manager.md))
- Per-business send failures are logged but do not block the rest of the fan-out

---

### 6.11 PWA & Offline

**Description:** Freshcast is installable as a Progressive Web App.

**Requirements:**
- Manifest with warm theme, standalone display, start URL `/dashboard`
- Network-first service worker with offline fallback page (`/offline`)
- Icons (192, 512, 512 maskable, apple-touch-icon)
- Branded splash screen on initial load

---

## 7. Privacy & Trust Model

### Core Principle

Each business's data is private and completely isolated.

### Rules

- No data sharing between businesses
- No benchmarking or aggregation across businesses
- No competitor insights
- AI insights and predictions based only on the user's own data
- Clear privacy messaging in the app

### User-Facing Message

> "Your data is private. Freshcast works only for your business."

---

## 8. Localization

### Current State

- English-only (`en`)
- All user-facing strings externalized via `next-intl` (~150 keys across 8 namespaces in `src/messages/en.json`)
- Date, number, and unit formatting respects locale via `Intl.*`
- Component design considers RTL even though no RTL locale is shipped today

### Future Direction

- Additional language packs based on target-market research (add a new `src/messages/{locale}.json` and update `src/i18n/request.ts`)
- Locale-specific unit defaults (e.g. kg vs. lbs)
- Localized LLM prompts for insight generation and chat

---

## 9. Platform & UX

### Platform

Mobile-first responsive PWA.

### UX Requirements

- Single-column layout, mobile-first
- Bottom tab bar (Home · Log Sales · Ask AI · History · Products); Settings via dashboard header
- Large, touch-friendly inputs and buttons
- Minimal typing required (NL parsing, manual stepper, receipt photo all available)
- Fast perceived response — React Query, aggregated dashboard endpoint, optimistic UI on save where safe
- Clean, uncluttered interface; clear visual hierarchy

### Design System (per [ADR-016](./adr/016-editorial-rebrand.md))

Editorial rebrand replaces the original utility palette with a warm, magazine-inspired system:

- **Palette:** cream backgrounds (`#FAF7F2`), terracotta accents (`#C44827`), deep ink for body, sage and ochre for chart accents. WCAG AA on body and CTA contrasts.
- **Typography:** Fraunces (serif headings) · Inter (body) · JetBrains Mono (numerics in dashboard cards)
- **Motion:** restrained — `prefers-reduced-motion` is honoured; no decorative animation on critical actions
- **Components:** shadcn/ui as the primitive layer, themed via Tailwind v4 CSS variables; per-page loading skeletons match real card layouts
- **Branded splash:** app icon on warm cream background during first load

Dark mode is not currently shipped; dark-mode-respectful design tokens are in place for a future phase.

---

## 10. Technical Architecture

The full technical architecture lives in [`docs/TDD.md`](./TDD.md). This section is a high-level summary intended for product readers.

### Frontend
- Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui (warm editorial theme)
- React Query (TanStack Query) for server state; react-hook-form + Zod for forms
- next-intl for externalized strings (~150 keys across 8 namespaces)
- PWA manifest + network-first service worker + offline fallback page

### Backend
- Next.js API routes (REST), proxy-based route protection (replaces middleware in Next.js 16)
- Auth.js v5 (Credentials, JWT) with rate limiting on auth, chat, and parse routes
- Server-only guards (`import "server-only"`) on every lib that reads secrets, per [ADR-017](./adr/017-next-config-no-env.md)

### Database
- PostgreSQL (Neon serverless)
- Prisma v7 ORM with PrismaPg adapter (ESM, Rust-free)
- All queries scoped to `businessId` from session; product ownership verified before SalesItem inserts

### AI Layer
- Claude Haiku 4.5 (Anthropic) — NL sales parsing, receipt line-item mapping, daily insights, AI chat
- LLM-primary with template/rule-based fallback for insights and the typed Log/NL tab; LLM-only for receipts (per [ADR-019](./adr/019-receipt-ocr-hardening.md))

### AWS Integrations
- Amazon SES — auth + weekly summary email delivery (Resend fallback)
- Amazon EventBridge — weekly summary scheduler
- Amazon S3 — receipt image storage with presigned PUT
- Amazon Textract `AnalyzeExpense` — structured receipt OCR
- AWS Secrets Manager — vendor API keys + cron secret (hybrid env→SM resolver per [ADR-018](./adr/018-secrets-manager.md))
- AWS Amplify — primary hosting (SSR + Console env vars routed through `amplify.yml`); Vercel as a mirror

### Operations
- Sentry error tracking
- Structured logger (color-coded, timestamped) on every API route
- Liveness probe at `GET /api/health` (DB + last-insight signal)
- 72 unit tests in CI (lint + typecheck + tests on every PR)

---

## 11. Data Model

The authoritative schema lives in `prisma/schema.prisma`; this section is a reader-friendly summary of the persisted models. Full per-model field semantics live in [`docs/API.md` § Data Models](./API.md#data-models).

```
User
├── id, email (unique), emailVerified?
├── passwordHash? (bcrypt cost 12; nullable for future OAuth)
├── name?, image?
├── isDemo  (demo account is undeletable + password-immutable)
└── createdAt, updatedAt

Business  (1:1 with User)
├── id, name, type (enum), locale (default "en")
├── timezone (IANA, default "UTC", validated server-side)
├── region (default "AU-VIC", drives holiday-aware predictions)
├── weeklyEmailEnabled (toggled via PATCH /api/business)
├── onboarded
└── createdAt, updatedAt

Product
├── id, name (unique per business), defaultUnit?, isActive
└── businessId → Business

SalesEntry  (no unique on businessId+date — multiple entries/day allowed)
├── id, date (@db.Date), inputMethod (NL | MANUAL)
├── rawInput?  (original NL text, or Textract rawText for receipts)
├── receiptKey? (S3 object key for receipt-origin entries)
└── businessId → Business, items: SalesItem[]

SalesItem
├── id, quantity, unit?
├── salesEntryId → SalesEntry
└── productId → Product

DailyInsight  (unique on businessId+date+type)
├── id, date, type (TREND | COMPARISON | TOP_PRODUCTS | SUMMARY)
├── content (insight text), metadata? (JSON)
├── generationMethod  ("template" | "llm")
└── businessId → Business

DemandForecast  (unique on businessId+productId+forecastDate)
├── id, forecastDate, predictedQuantity, confidence, generatedAt
└── businessId → Business, productId → Product
```

---

## 12. User Flow Summary

### Day 1
`Sign up → Onboarding (name, type, products) → Dashboard (empty state with guidance)`

### Daily Use
`Open app → Log sales (NL or manual) → Confirm → Save → View updated dashboard`

### After 1 Week
`View trends → See demand predictions → Read AI insights → Make stocking decisions`

### Ongoing
`Daily logging → Improving predictions → Better business decisions`

---

## 13. Delivery Status

The MVP shipped and was followed by post-MVP enhancements (PWA, editorial rebrand, AI chat, receipt OCR, AWS migration, Secrets Manager, OCR hardening). Phase-by-phase delivery and current status live in [`docs/IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md); user-visible changes by release live in [`CHANGELOG.md`](../CHANGELOG.md).

This PRD describes the product as it stands today. Architectural decisions taken along the way are recorded as ADRs in [`docs/adr/`](./adr/README.md) and are intentionally frozen — they record what was decided and why, at the time.

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Users won't input data regularly | Make input extremely fast (< 30s), offer dual input modes, minimize setup |
| NL parser misinterprets input | Confirmation step before saving, editable parsed results, manual form fallback |
| Low perceived value early on | Show insights quickly (even small ones), seed demo data for first-time experience |
| Predictions inaccurate with little data | Communicate minimum data requirements, show confidence levels, improve over time |
| Localization adds complexity | Externalize strings from day one, use established i18n patterns |

---

## 15. Future Direction

The prioritized list of candidate enhancements lives in [`docs/BACKLOG.md`](./BACKLOG.md). Themes worth flagging at the product level:

- **Enhanced input** — voice logging via Amazon Transcribe (async, [BACKLOG #34](./BACKLOG.md))
- **Operational maturity** — observability (LLM cost tracking, request logging), evaluation harness for the NL parser
- **Frontend polish** — optimistic updates, offline support beyond the basic PWA shell, accessibility audit
- **Authentication upgrades** — Amazon Cognito for MFA + social login
- **Platform expansion** — native mobile, multi-user per business, multi-branch
- **Ecosystem** — POS integrations, supplier/purchase-order management, opt-in anonymized benchmarking
- **Pricing & revenue** — explicitly excluded from the current product (see §4); a future phase could add optional price-per-product if user research justifies it

Architectural decisions for any of the above will be captured as ADRs at the time they are made; this PRD will be updated when the *product* changes.

---

## 16. Product Statement

> **Freshcast** is a lightweight AI assistant that helps small retail businesses turn daily sales quantities into meaningful insights and smarter stocking decisions — without the complexity of traditional systems. Its core differentiator is quantity-based demand prediction that tells vendors what to prepare for tomorrow, made accessible via three forgiving input modes (typed NL, manual form, receipt photo) and a calm, editorial dashboard.
