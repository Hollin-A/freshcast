# Changelog

All notable changes to Freshcast are documented here.

---

## Unreleased

### Added
- Business-type-aware placeholder text in NL sales input
- Editable product names in sales confirmation screen
- Unit normalization on product creation and updates
- Receipt photo upload flow (presigned S3 upload + OCR parsing)
- Receipt-to-sales pipeline integration with confirmation review before save
- Sales history "From receipt" badge for OCR-origin entries

### Security
- Removed all entries from `next.config.ts` `env` (per ADR-017). The field inlines values into the client JavaScript bundle regardless of `NEXT_PUBLIC_` semantics, which had been exposing server secrets in production builds.
- Routed Amplify Console env vars through `amplify.yml` into `.env.production` before `next build` so SSR can read them at runtime without inlining server values into the client.
- Added `import "server-only"` guards to lib modules that read secret env vars (`prisma`, `email`, `ses`, `claude`, `s3`, `aws-config`, `env`) so any future client-side import fails the build.
- Operators must rotate every secret previously listed in `next.config.ts` `env` (`AUTH_SECRET`, Neon DB password, `CRON_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`); rotating `AUTH_SECRET` invalidates existing sessions.

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
