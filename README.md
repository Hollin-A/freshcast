# Freshcast

AI-powered sales tracking and demand prediction for small retail businesses. Log daily sales in natural language, get insights and forecasts — without the complexity of traditional POS systems.

**[Live Demo →](https://freshcast-au.vercel.app/)** · **[AWS Demo →](https://freshcast.site/)** · Demo login: `demo@freshcast.app` / `demo1234`

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard" width="280" />
  <img src="docs/screenshots/insights.png" alt="Insights" width="280" />
  <img src="docs/screenshots/sales_input_nl_parse.png" alt="Natural Language Sales Input" width="280" />
  <img src="docs/screenshots/ai_chat_response.png" alt="Chat" width="280" />
</p>

<details>
<summary>More screenshots</summary>
<p align="center">
  <img src="docs/screenshots/sales_input_manual_form.png" alt="Manual Sales Input" width="280" />
  <img src="docs/screenshots/products.png" alt="Products" width="280" />
  <img src="docs/screenshots/sales_history.png" alt="Sales History" width="280" />
  <img src="docs/screenshots/settings.png" alt="Settings" width="280" />
  <img src="docs/screenshots/onboarding_step_01.png" alt="Onboarding" width="280" />
  <img src="docs/screenshots/login.png" alt="Login" width="280" />
  <img src="docs/screenshots/signup.png" alt="Sign Up" width="280" />
  <img src="docs/screenshots/reset_password.png" alt="Reset Password" width="280" />
</p>
</details>

---

## What it does

Freshcast helps small business owners (market vendors, butchers, cafés) track what they sell and predict what they'll need tomorrow.

- **Natural language sales input** — type "sold 20 eggs, 30kg beef" and the parser extracts structured data
- **Manual form input** — tap through a product list with quantity fields
- **Demand predictions** — "You may need ~25 eggs tomorrow" based on weekday patterns and recent trends
- **Auto-generated insights** — "Egg sales increased 23% this week", "Friday is your strongest day"
- **Dashboard** — today's summary, weekly trends with bar chart, top products, forecasts

## How it works

### Sales Parser

A rule-based NL parser tokenizes input by commas and "and", extracts quantities and units (kg, g, liters, dozen), and fuzzy-matches product names against the user's catalog using Levenshtein distance, substring matching, and plural normalization. Unmatched items are flagged as new products for the user to confirm.

### Prediction Engine

Uses a weighted blend of two signals:
- **Weekday pattern** (60%) — averages the last 4 occurrences of the same weekday
- **Recent trend** (40%) — averages the last 7 days

Confidence scoring adjusts based on data volume and variance. Predictions start after 5 days of data.

### Insight Generator

LLM-powered insight generation (Claude Haiku) with template-based fallback. Produces headline + description pairs for the dashboard. Computes per-product trends, week-over-week comparisons, top product concentration, and weekday patterns. Generated on-demand when the dashboard detects stale data (>24 hours), cached in the database to avoid redundant LLM calls.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| UI | Tailwind CSS v4, shadcn/ui, Fraunces + Inter + JetBrains Mono |
| State | React Query (TanStack Query) |
| Forms | react-hook-form + Zod v4 |
| Auth | Auth.js v5 (Credentials provider, JWT) |
| Database | PostgreSQL (Neon serverless) |
| ORM | Prisma v7 (ESM, PrismaPg adapter) |
| AI | Claude Haiku (Anthropic) — NL parsing, insights, chat |
| Email | Amazon SES (primary), Resend (fallback) |
| Scheduling | Amazon EventBridge (AWS), Vercel Cron (fallback) |
| Monitoring | Sentry error tracking |
| i18n | next-intl (externalized strings) |
| Testing | Vitest (52 unit tests), GitHub Actions CI |
| Deployment | Vercel (primary), AWS Amplify (AWS integrations) |

## Architecture

```
Client (Browser)
  └── Next.js App Router (RSC + Client Components)
        ├── API Routes (REST)
        │     ├── Auth (signup, login, password reset)
        │     ├── Business & Products (CRUD)
        │     ├── Sales (parse, create, list, delete)
        │     ├── Dashboard (aggregated single-call)
        │     ├── Chat (AI-powered Q&A)
        │     └── Health & Admin
        ├── Services
        │     ├── Sales Parser (LLM + rule-based fallback)
        │     ├── Product Matcher (fuzzy matching)
        │     ├── Analytics (trends, comparisons)
        │     ├── Prediction Engine (moving averages + holidays)
        │     ├── Insight Generator (LLM + template fallback)
        │     └── Weekly Email (summary + forecast)
        ├── AWS Services
        │     ├── SES (email delivery)
        │     └── EventBridge (scheduled jobs)
        └── Prisma ORM → PostgreSQL (Neon)
```

Key architectural decisions are documented in [ADRs](docs/adr/README.md).

## Project Documentation

This project was built with a spec-driven development approach:

- **[Product Requirements Document](docs/PRD.md)** — features, user stories, success metrics
- **[Architecture Decision Records](docs/adr/README.md)** — 16 ADRs covering auth strategy, NL parsing, editorial rebrand, data isolation, and more
- **[Technical Design Document](docs/TDD.md)** — system architecture, data model, full API contracts, service algorithms
- **[Implementation Plan](docs/IMPLEMENTATION_PLAN.md)** — 28+ phases with tasks, acceptance criteria, and completion tracking
- **[Improvement Backlog](docs/BACKLOG.md)** — prioritized list of future enhancements and AWS integrations
- **[Changelog](CHANGELOG.md)** — shipped changes by release

### Documentation ownership

To avoid duplication and stale docs:

- Product scope and intent live in `docs/PRD.md`
- Runtime architecture and technical details live in `docs/TDD.md`
- API contracts live in `docs/API.md`
- Execution history and phase tracking live in `docs/IMPLEMENTATION_PLAN.md`
- Release deltas live in `CHANGELOG.md`

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (or [Neon](https://neon.tech) free tier)

### Setup

```bash
git clone https://github.com/Hollin-A/freshcast.git
cd freshcast
npm install
```

Create a `.env` file:

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=your-secret-here
AUTH_URL=http://localhost:3000
```

Set up the database:

```bash
npx prisma db push
npx prisma generate
```

Optionally seed with demo data:

```bash
npx tsx prisma/seed.ts
```

Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

Run the test suite:

```bash
npm test
```

Tests cover core business logic: sales parser, product matcher, prediction engine, unit normalizer, date utilities, holiday multipliers, and rate limiter. All tests are pure unit tests with no database or network calls.

CI runs automatically on every push and PR via GitHub Actions — linting, type checking, and tests.

## Current Scope

Freshcast is production-ready for single-business usage with:

- Sales logging (natural language + manual)
- Forecasting, insights, and AI chat grounded in business data
- Privacy and safety controls (business isolation, rate limits, account safeguards)
- Operational foundations (monitoring, health checks, CI, testing, dual deployment)

Planned and deferred work is tracked in `docs/BACKLOG.md` and `docs/IMPLEMENTATION_PLAN.md`.

## License

MIT
