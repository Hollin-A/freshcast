# Changelog

All notable changes to Freshcast are documented here.

---

## Unreleased

### Added
- Request IDs: every API response carries an `x-request-id` header (a valid incoming one is reused), and every log line written while handling the request includes it.
- One `request completed` log line per API request, with method, path, status and duration. Query strings and bodies aren't logged.

### Changed
- Retired the Vercel mirror deployment (ADR-020 D7): removed `vercel.json` (its cron never reached the route) and the Vercel demo link. AWS Amplify is the only host.
- The weekly summary email is paused and its Settings toggle hidden until the feature is rebuilt (#42). Emails were never delivered: scheduler requests were rejected by the session proxy, and the EventBridge connection was deauthorized. The legacy EventBridge rule has been removed.
- Zod request schemas, response-envelope types and the constants they use moved into the `@freshcast/shared` workspace package (`packages/shared`), imported directly by the web app. Schemas use the Zod 4 forms `z.iso.date()` and `z.flattenError()` (same validation and output).
- Prisma moved into the `@freshcast/db` workspace package (`packages/db`): schema, migrations, seed and a `createPrismaClient()` factory, compiled with `tsc` and built by Turborepo before the web app. Prisma commands now run as `pnpm --filter @freshcast/db <migrate:deploy|migrate:dev|migrate:status|seed>` and read `packages/db/.env`. Migration names are unchanged. Amplify builds skip nvm's default global packages.
- Repository is now a pnpm workspace with Turborepo: the Next.js app moved to `apps/web` (`@freshcast/web`), and root scripts (`pnpm dev`, `build`, `lint`, `typecheck`, `test`) run through Turborepo with caching. The web app's `.env` moved to `apps/web/.env`. Amplify builds use the monorepo format (`appRoot: apps/web`). After `next build`, a post-build step replaces Turbopack's `.next/node_modules` alias symlinks with real copies, because Amplify's flattened runtime layout broke them (the first attempt, #67, was reverted in #69).
- Package manager switched from npm to pnpm (pinned via `packageManager` and Corepack); `pnpm-lock.yaml` replaces `package-lock.json`. CI and Amplify builds use Node 24, and CI now also runs a production build. `node_modules` uses pnpm's hoisted (flat) layout, because Amplify's SSR runtime couldn't load the default symlinked layout and returned HTTP 500 from every route handler.
- Receipt photo upload and parsing are switched off by default behind `RECEIPT_UPLOAD_ENABLED`. When off, the upload button is hidden and both receipt endpoints return `503 FEATURE_DISABLED`. When on, each endpoint is limited to 20 requests per business per hour, and uploads are capped at 10 MB through the signed `Content-Length` of the upload URL.
- Database: added indexes for business-scoped sales queries, `SalesEntry (businessId, date)` and `SalesItem (salesEntryId)`.
- Database: a catch-up migration records schema changes previously applied with `db push`, so a database built from `prisma/migrations` now matches `schema.prisma`. Setup and schema changes use `prisma migrate` (README, CONTRIBUTING).
- All JSON API routes now return a standard envelope: `{ data, meta? }` on success, and the existing `{ error: { code, message, details? } }` on failure. `GET /api/products` returns the product array as `data`; `GET /api/sales` returns entries as `data` with pagination in `meta`. Frontend calls go through a shared `apiFetch` client helper. See `docs/API.md`.
- Zod request schemas are consolidated in `src/schemas/`, shared by API routes and forms.
- Production logs are single-line JSON (`level`, `timestamp`, `context`, `message`, `requestId`, `data`) for CloudWatch filtering; local dev keeps the colored format.

### Fixed
- The signup form now limits the name to 100 characters, matching the API, and shows a field message instead of a generic error.

## v1.1.0 — 2026-06-17 — Receipt OCR Hardening & Secrets Management

### Added
- Business-type-aware placeholder text in NL sales input
- Editable product names in sales confirmation screen
- Unit normalization on product creation and updates
- Receipt photo upload flow (presigned S3 upload + OCR parsing)
- Receipt-to-sales pipeline integration with confirmation review before save
- Sales history "From receipt" badge for OCR-origin entries
- Remove (×) button on unmatched items in the sales confirmation screen — every parsed row is now recoverable in one tap regardless of match status

### Changed
- Receipt parsing is now AI-only (per ADR-019). When the AI service is temporarily unavailable, the receipt path returns a clear error pointing the user to typing or manual entry, instead of falling back to the chat-style parser that produces unusable results on receipt OCR text. The rule-based parser continues to back the typed Log/NL tab where it was designed to work.
- Textract line joining now preserves layout (`\n`) instead of collapsing to commas, which is cleaner signal for the AI parser and avoids misleading tokenization.
- Receipt OCR now uses Amazon Textract `AnalyzeExpense` (the receipt/invoice-shaped API) instead of `DetectDocumentText` (raw line OCR). AWS now returns pre-structured line items with separate description, quantity, and price fields, so the AI parser only has to map descriptions to known products and resolve abbreviations — no more discovering line items in receipt noise. Accuracy improves and the prompt is materially smaller.
- Receipt parse responses now include the AWS-structured `lineItems` alongside the existing `parsed` items, for transparency and future reconciliation flows.

### Operator notes
- New optional env var `RECEIPT_FALLBACK=structured` opts into a receipt-shaped rule-based fallback when the LLM is unavailable. Off by default per ADR-019. Pending the broader feature-flag system in Phase 32.1.3.
- `AnalyzeExpense` is roughly 10× per-page cost of `DetectDocumentText` (still pennies per business per month at expected receipt volumes). Worth surfacing in CloudWatch once Phase 30.2 lands.
- **IAM:** the Amplify SSR Lambda execution role must grant `textract:AnalyzeExpense` (a different action from the `textract:DetectDocumentText` granted in Phase 29). If the policy was scoped to `DetectDocumentText` only, receipt parsing will fail in production with `AccessDeniedException`. Verify before next deploy.

### Security
- Removed all entries from `next.config.ts` `env` (per ADR-017). The field inlines values into the client JavaScript bundle regardless of `NEXT_PUBLIC_` semantics, which had been exposing server secrets in production builds.
- Routed Amplify Console env vars through `amplify.yml` into `.env.production` before `next build` so SSR can read them at runtime without inlining server values into the client.
- Added `import "server-only"` guards to lib modules that read secret env vars (`prisma`, `email`, `ses`, `claude`, `s3`, `aws-config`, `env`) so any future client-side import fails the build.
- Operators must rotate every secret previously listed in `next.config.ts` `env` (`AUTH_SECRET`, Neon DB password, `CRON_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`); rotating `AUTH_SECRET` invalidates existing sessions.
- Migrated `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, and `CRON_SECRET` to **AWS Secrets Manager** with a hybrid env→SM resolver in `src/lib/secrets.ts` (per ADR-018). `DATABASE_URL` and `AUTH_SECRET` remain in `.env.production` due to documented framework constraints. Resolution is env-first so local dev continues to work without any AWS calls; the SM path becomes load-bearing once the env entries are pruned from the Amplify Console.
- Hardened `AUTH_URL` to be required at startup. The three auth routes (`signup`, `forgot-password`, `send-verification`) no longer fall back to `http://localhost:3000` if `AUTH_URL` is missing; they now fail loudly via `requireEnv("AUTH_URL")`. Prevents the silent failure mode where a missing env var would cause production password-reset emails to ship localhost links.

---

## v0.1.0 — MVP + Post-MVP

### Core Features
- Natural language sales input with LLM parser (Claude Haiku) and rule-based fallback
- Manual form input with product list and quantity steppers
- Dual-mode sales logging with confirmation screen
- Fuzzy product matching with inline product creation
- Multiple sales entries per day with date picker

### Dashboard & Intelligence
- Tomorrow's forecast with per-product sparklines and trend percentages
- Week rhythm chart with peak day highlight
- Top products with colored progress bars
- AI-generated insights with headline + description format
- Prediction progress bar (auto-hides at 30+ entries)
- Forecast detail drill-in with 14-day chart and prediction breakdown
- Holiday-aware predictions (AU-VIC public holidays)

### AI Integration
- LLM-powered NL sales parsing with ambiguous quantity detection
- LLM-powered insight generation with template fallback
- AI chat interface (floating bubble) for business questions
- Unit normalization across both parsers

### Auth & Onboarding
- Email/password authentication with JWT sessions
- Password reset flow with email delivery (Amazon SES primary, Resend fallback)
- Email verification (optional)
- 3-step onboarding with business type tiles and product setup

### Data & Export
- Sales history with date grouping and NL quote display
- CSV export of sales history
- Per-product analytics (daily average, week-over-week trend)
- Weekly summary email (opt-in, EventBridge scheduling with Vercel Cron fallback)

### Platform
- PWA support (installable, offline fallback)
- Editorial rebrand (warm cream/terracotta palette, serif headings)
- Mobile-first responsive design
- i18n architecture (externalized strings, next-intl)

### Security
- Rate limiting on auth, chat, and parse endpoints
- Demo account protection (undeletable, password unchangeable)
- Input sanitization on text fields
- Product ownership verification
- Atomic database transactions

### Developer Experience
- 52 unit tests (Vitest) covering parser, matcher, predictions, dates, rate limiter, holidays
- GitHub Actions CI (lint, type check, tests)
- Structured logging with color-coded levels
- 16 Architecture Decision Records
