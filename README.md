# Freshcast

AI-powered sales tracking and demand prediction for small retail businesses. Log daily sales in natural language, get insights and forecasts — without the complexity of traditional POS systems.

**[Live Demo →](https://freshcast.site/)** · Demo login: `demo@freshcast.site` / `demo1234`

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
- **Receipt photo upload** — snap a supplier or POS receipt; AWS Textract `AnalyzeExpense` extracts structured line items, the LLM maps them to your products, and you confirm before saving. *Currently switched off by default (`RECEIPT_UPLOAD_ENABLED`); see [ADR-019](docs/adr/019-receipt-ocr-hardening.md).*
- **Demand predictions** — "You may need ~25 eggs tomorrow" based on weekday patterns and recent trends, with holiday-aware adjustments
- **Auto-generated insights** — "Egg sales increased 23% this week", "Friday is your strongest day"
- **AI chat** — ask questions about your own data ("what sold best this week?")
- **Weekly summary email** — opt-in digest with last week's totals and the week-ahead forecast. *Paused: being rebuilt on a scheduled job queue ([#42](https://github.com/Hollin-A/freshcast/issues/42)).*
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
| Forms | react-hook-form + Zod v4 (schemas shared via `@freshcast/shared`) |
| Auth | Auth.js v5 (Credentials provider, JWT) |
| Database | PostgreSQL (Neon serverless) |
| ORM | Prisma v7 (ESM, PrismaPg adapter) in `@freshcast/db` |
| AI | Claude Haiku (Anthropic) — NL parsing, insights, chat, receipt mapping |
| Email | Amazon SES (primary), Resend (fallback) |
| Scheduling | Paused; to be rebuilt on EventBridge Scheduler + SQS ([#42](https://github.com/Hollin-A/freshcast/issues/42)) |
| OCR | Amazon Textract `AnalyzeExpense` (receipts) |
| Storage | Amazon S3 (receipt images, presigned uploads) |
| Secrets | AWS Secrets Manager (vendor API keys, hybrid env→SM resolver) |
| Monitoring | Structured JSON logs with request IDs (CloudWatch); Sentry (initialization fix pending, [#68](https://github.com/Hollin-A/freshcast/issues/68)) |
| i18n | next-intl (externalized strings) |
| Testing | Vitest (137 tests, including React component tests), Storybook story tests, Playwright journeys with screenshot baselines, GitHub Actions CI (lint, type check, test, build) |
| Deployment | AWS Amplify |
| Monorepo | pnpm workspaces + Turborepo |

## Architecture

```
Client (Browser, PWA) — forms validate with @freshcast/shared
  └── apps/web — Next.js App Router (RSC + Client Components) on AWS Amplify
        ├── proxy.ts (session check, request IDs)
        ├── API Routes (REST, { data } / { error } envelope)
        │     ├── Auth (signup, login, password reset, email verification)
        │     ├── Business & Products (CRUD)
        │     ├── Sales (parse, create, list, edit, delete, export CSV)
        │     ├── Receipts (presigned upload, OCR + parse; off by default)
        │     ├── Dashboard (aggregated single-call)
        │     ├── Predictions & Insights (cached + on-demand)
        │     ├── Chat (AI-powered Q&A)
        │     ├── Weekly summary email (paused, #42)
        │     └── Health & Demo
        ├── Services
        │     ├── Sales Parser (LLM + rule-based fallback)
        │     ├── Receipt Parser (LLM + structured rule-based, opt-in fallback)
        │     ├── Product Matcher (fuzzy matching)
        │     ├── Analytics (trends, comparisons)
        │     ├── Prediction Engine (moving averages + weekday + holidays)
        │     ├── Insight Generator (LLM + template fallback)
        │     ├── Chat Context Builder (business data → Claude prompt)
        │     └── Weekly Email (summary + forecast; scheduling paused)
        ├── AWS Services
        │     ├── SES (auth emails)
        │     ├── S3 + Textract `AnalyzeExpense` (receipts)
        │     └── Secrets Manager (Anthropic, Resend, cron secret)
        ├── @freshcast/shared — Zod schemas, API response types, shared constants
        └── @freshcast/db — Prisma client factory → PostgreSQL (Neon)
```

### Repository layout

A pnpm workspace built with Turborepo: the App (`apps/web`), the API (`apps/api`, replacing the Legacy API per ADR-020) and two shared packages (`packages/db`, `packages/shared`). The full layout is in [Architecture → Project Structure](docs/ARCHITECTURE.md#22-project-structure); build, deployment and preview branches are in [Architecture → Build and Deployment](docs/ARCHITECTURE.md#11-build-and-deployment).

Key architectural decisions are documented in [ADRs](docs/adr/README.md).

## Project Documentation

- **[Glossary](GLOSSARY.md)** — the words Freshcast uses for its domain, surfaces and presentation, and the synonyms to avoid
- **[Architecture](docs/ARCHITECTURE.md)** — system architecture, data model, service algorithms, security, and operations
- **[API Reference](docs/API.md)** — request/response shapes, error codes, and data models for every endpoint
- **[Architecture Decision Records](docs/adr/README.md)** — the index of architectural decisions and their status
- **[Testing](docs/TESTING.md)** — how each kind of test is written and run
- **[Changelog](CHANGELOG.md)** — shipped changes by release
- **[Contributing Guide](CONTRIBUTING.md)** — branch strategy, PR format, and the documentation sync table

Each topic has one home; the [documentation sync table](CONTRIBUTING.md#documentation-sync-requirements) says which file owns what.

## Getting Started

### Prerequisites

- Node.js 22.22+ or 24.15+ (24 recommended)
- pnpm, via Corepack: run `corepack enable` once and the version pinned in `package.json` is used automatically
- PostgreSQL database (or [Neon](https://neon.tech) free tier)

### Setup

```bash
git clone https://github.com/Hollin-A/freshcast.git
cd freshcast
pnpm install
```

Create `apps/web/.env` (the web app reads its env file from its own folder):

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

Prisma lives in the `@freshcast/db` package (`packages/db`). Its commands read `DATABASE_URL` from `packages/db/.env`, so create that file with the same `DATABASE_URL` line:

```env
DATABASE_URL=postgresql://...
```

Set up the database by applying the migrations in `packages/db/prisma/migrations`:

```bash
pnpm --filter @freshcast/db migrate:deploy
```

Optionally seed with demo data:

```bash
pnpm --filter @freshcast/db seed
```

Run the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

`pnpm dev` also starts the NestJS API (`apps/api`) on port 4000. It reads `apps/api/.env`, where `DATABASE_URL` and `AUTH_SECRET` are required, with `AUTH_SECRET` matching `apps/web/.env` so the API can read the App's session cookie (optional: `PORT`, default 4000; `AWS_REGION`, default `ap-southeast-2`). Without it, the API logs a configuration error and the web app runs as usual. To run only the API: `pnpm --filter @freshcast/api dev`. Its docs are at http://localhost:4000/docs.

## Testing

`pnpm test` runs every package's unit and component tests. Stories, Playwright journeys with screenshot baselines, and the API's e2e tests are covered in [docs/TESTING.md](docs/TESTING.md). CI runs all of them on every pull request.

## Current Scope

Freshcast is production-ready for single-business usage with:

- Sales logging (natural language + manual)
- Forecasting, insights, and AI chat grounded in business data
- Privacy and safety controls (business isolation, rate limits, account safeguards)
- Operational foundations (structured logging, health checks, CI-gated deploys, testing)

### Non-goals

Freshcast deliberately does not:

- Replace a POS system
- Manage inventory, suppliers or purchase orders
- Require a full product catalogue before a Vendor can log sales
- Track prices or revenue (quantities only, [ADR-004](docs/adr/004-quantity-only-tracking.md))
- Compare one Business with another ([ADR-008](docs/adr/008-data-isolation-privacy.md))

The backend is moving to a dedicated NestJS API ([ADR-020](docs/adr/020-dedicated-nestjs-backend.md)). Planned work is tracked in [GitHub Issues](https://github.com/Hollin-A/freshcast/issues) and on the [project board](https://github.com/users/Hollin-A/projects/1).

## License

MIT
