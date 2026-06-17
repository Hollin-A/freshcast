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
- **Receipt photo upload** — snap a supplier or POS receipt; AWS Textract `AnalyzeExpense` extracts structured line items, the LLM maps them to your products, and you confirm before saving
- **Demand predictions** — "You may need ~25 eggs tomorrow" based on weekday patterns and recent trends, with holiday-aware adjustments
- **Auto-generated insights** — "Egg sales increased 23% this week", "Friday is your strongest day"
- **AI chat** — ask questions about your own data ("what sold best this week?")
- **Weekly summary email** — opt-in digest with last week's totals and the week-ahead forecast
- **Dashboard** — today's summary, weekly trends with bar chart, top products, forecasts, demand spike alerts

## How it works

- **Sales parsing** is LLM-primary with a rule-based fallback. Typed input goes to Claude Haiku (raw text + the user's product catalogue) to extract structured `{product, quantity, unit}` items; if the LLM is unavailable, a rule-based parser tokenizes and fuzzy-matches against the catalogue. Receipts take a separate path — AWS Textract `AnalyzeExpense` returns structured line items that an LLM maps to known products (per [ADR-019](docs/adr/019-receipt-ocr-hardening.md)). Everything flows through the same unit normalizer and confirmation screen before saving.
- **Demand prediction** blends a weekday pattern with a recent-trend signal, applies holiday-aware adjustments, and scores confidence by data volume and variance. Predictions begin after 5 days of data.
- **Insights** are LLM-generated (Claude Haiku) with a template fallback, computed on-demand when dashboard data is stale and cached to avoid redundant LLM calls.

Full algorithms, weights, and service contracts are documented in [Architecture](docs/ARCHITECTURE.md).

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
| AI | Claude Haiku (Anthropic) — NL parsing, insights, chat, receipt mapping |
| Email | Amazon SES (primary), Resend (fallback) |
| Scheduling | Amazon EventBridge (AWS), Vercel Cron (fallback) |
| OCR | Amazon Textract `AnalyzeExpense` (receipts) |
| Storage | Amazon S3 (receipt images, presigned uploads) |
| Secrets | AWS Secrets Manager (vendor API keys, hybrid env→SM resolver) |
| Monitoring | Sentry error tracking |
| i18n | next-intl (externalized strings) |
| Testing | Vitest (72 unit tests), GitHub Actions CI |
| Deployment | AWS Amplify (primary), Vercel (mirror) |

## Architecture

```
Client (Browser, PWA)
  └── Next.js App Router (RSC + Client Components)
        ├── API Routes (REST)
        │     ├── Auth (signup, login, password reset, email verification)
        │     ├── Business & Products (CRUD)
        │     ├── Sales (parse, create, list, edit, delete, export CSV)
        │     ├── Receipts (presigned upload, OCR + parse)
        │     ├── Dashboard (aggregated single-call)
        │     ├── Predictions & Insights (cached + on-demand)
        │     ├── Chat (AI-powered Q&A)
        │     ├── Email cron (weekly summary)
        │     └── Health & Demo
        ├── Services
        │     ├── Sales Parser (LLM + rule-based fallback)
        │     ├── Receipt Parser (LLM + structured rule-based, opt-in fallback)
        │     ├── Product Matcher (fuzzy matching)
        │     ├── Analytics (trends, comparisons)
        │     ├── Prediction Engine (moving averages + weekday + holidays)
        │     ├── Insight Generator (LLM + template fallback)
        │     ├── Chat Context Builder (business data → Claude prompt)
        │     └── Weekly Email (summary + forecast)
        ├── AWS Services
        │     ├── SES (auth + weekly summary email delivery)
        │     ├── EventBridge (scheduled jobs)
        │     ├── S3 (receipt image storage, presigned PUT)
        │     ├── Textract `AnalyzeExpense` (structured receipt OCR)
        │     └── Secrets Manager (Anthropic, Resend, cron secret)
        └── Prisma ORM → PostgreSQL (Neon)
```

Key architectural decisions are documented in [ADRs](docs/adr/README.md).

## Project Documentation

- **[Architecture](docs/ARCHITECTURE.md)** — system architecture, data model, service algorithms, security, and operations
- **[API Reference](docs/API.md)** — request/response shapes, error codes, and data models for every endpoint
- **[Architecture Decision Records](docs/adr/README.md)** — 19 ADRs covering auth strategy, NL parsing, editorial rebrand, data isolation, env loading on Amplify, secrets management, receipt OCR hardening, and more
- **[Changelog](CHANGELOG.md)** — shipped changes by release
- **[Contributing Guide](CONTRIBUTING.md)** — branch strategy, PR checklist, and doc-sync rules

### Documentation ownership

To avoid duplication and stale docs, each topic has a single home:

- Architecture, runtime details, and the data model live in `docs/ARCHITECTURE.md`
- Endpoint contracts live in `docs/API.md`
- Architectural decisions live in `docs/adr/`
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
# Required
DATABASE_URL=postgresql://...
AUTH_SECRET=your-secret-here
AUTH_URL=http://localhost:3000

# Recommended for full local-dev experience (LLM + receipt OCR + email)
ANTHROPIC_API_KEY=sk-ant-...           # NL parser, receipt mapping, insights, chat
APP_AWS_REGION=ap-southeast-2
APP_AWS_ACCESS_KEY_ID=...
APP_AWS_SECRET_ACCESS_KEY=...
S3_RECEIPTS_BUCKET=your-receipts-bucket
SES_FROM_EMAIL=verified@example.com    # if exercising email flows locally
RESEND_API_KEY=re_...                  # optional fallback for email
```

Notes:
- Some platforms reserve the `AWS_*` prefix. Freshcast prefers `APP_AWS_*` and also supports `AWS_*` as a fallback.
- LLM features degrade gracefully without `ANTHROPIC_API_KEY` (NL parser falls back to rule-based; insights fall back to templates; chat is disabled). Receipt OCR returns 503 in this case — see [ADR-019](docs/adr/019-receipt-ocr-hardening.md).
- In production, vendor API keys and the cron secret are sourced from AWS Secrets Manager via a hybrid env→SM resolver — see [ADR-018](docs/adr/018-secrets-manager.md). Local dev continues to use plain env vars.

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

Tests cover core business logic: sales parser, LLM sales parser, product matcher, prediction engine, insight generator, unit normalizer, date utilities, holiday multipliers, rate limiter, Textract `AnalyzeExpense` mapping, and the rule-based receipt parser. All tests are pure unit tests with no database or network calls.

CI runs automatically on every push and PR via GitHub Actions — linting, type checking, and tests.

## Current Scope

Freshcast is production-ready for single-business usage with:

- Sales logging (natural language + manual)
- Forecasting, insights, and AI chat grounded in business data
- Privacy and safety controls (business isolation, rate limits, account safeguards)
- Operational foundations (monitoring, health checks, CI, testing, dual deployment)

Planned and deferred work is tracked in the project's internal backlog and implementation plan.

## License

MIT
