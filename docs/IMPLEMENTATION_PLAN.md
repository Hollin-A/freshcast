# BizSense — Implementation Plan

This document tracks the phased implementation of BizSense MVP. Each phase has clear deliverables, acceptance criteria, and a dependency chain. Phases are designed to be independently testable — you verify each one works before moving to the next.

References: [PRD](./PRD.md) · [TDD](./TDD.md) · [ADRs](./adr/README.md)

---

## What's Already Done

- [x] Project scaffolding (Next.js 16, Tailwind v4, TypeScript, ESM)
- [x] Prisma v7 schema with PrismaPg adapter (all models, enums, relations)
- [x] Auth.js v5 config (Credentials provider, JWT sessions, Prisma adapter)
- [x] Signup API route (`POST /api/auth/signup`)
- [x] Auth route handler (`/api/auth/[...nextauth]`)
- [x] Proxy (`src/proxy.ts` — route protection, replaces middleware in Next.js 16)
- [x] React Query provider with SessionProvider
- [x] Root layout with Toaster (sonner)
- [x] i18n message file (`src/messages/en.json`)
- [x] Type definitions and constants
- [x] API helpers (error responses, getBusinessId, getBusinessContext)
- [x] Timezone-aware date utilities (`src/lib/dates.ts`)
- [x] Structured logger (`src/lib/logger.ts`)
- [x] Environment variable validation (`src/lib/env.ts`)

---

## Phase 1: Database & Auth UI
Branch: `feat/phase-1-auth`

### Goal
Users can sign up, log in, and have a working database behind it all.

### Tasks
- [x] 1.1 Set up Neon database and run `prisma migrate dev` to create tables
- [x] 1.2 Install shadcn/ui CLI and add base components (Button, Input, Card, Label, Tabs, Sheet, Select, Separator, Badge, Skeleton)
- [x] 1.3 Build signup page (`/signup`) with react-hook-form + zod validation
- [x] 1.4 Build login page (`/login`) with email/password form
- [x] 1.5 Add auth redirect logic: authenticated users → `/dashboard`, unauthenticated → `/login`
- [x] 1.6 Create placeholder dashboard page (`/dashboard`) that shows the logged-in user's email
- [x] 1.7 Add logout functionality

### Acceptance Criteria
- Can create an account via `/signup` and see it in the database
- Can log in via `/login` and land on `/dashboard`
- Visiting `/dashboard` while logged out redirects to `/login`
- Visiting `/login` while logged in redirects to `/dashboard`
- Can log out and get redirected to `/login`

---

## Phase 2: Onboarding
Branch: `feat/phase-2-onboarding`

### Goal
New users complete a quick onboarding flow that creates their business profile and initial products.

### Dependencies
Phase 1 complete.

### Tasks
- [x] 2.1 Build `POST /api/business` route (create business + initial products, zod validation)
- [x] 2.2 Build `GET /api/business` route (get business profile)
- [x] 2.3 Build onboarding page (`/onboarding`) with multi-step wizard:
  - Step 1: Business name + type
  - Step 2: Add 3–5 core products
  - Step 3: Locale preference (optional, default "en")
- [x] 2.4 Add onboarding guard: if user has no business or `onboarded=false`, redirect to `/onboarding`
- [x] 2.5 After onboarding completion, redirect to `/dashboard`

### Acceptance Criteria
- New user signs up → lands on `/onboarding`
- Can fill in business name, select type, add products
- Completing onboarding creates Business + Products in DB
- After onboarding, user lands on `/dashboard`
- Returning user who completed onboarding goes straight to `/dashboard`
- Onboarding completes in < 2 minutes

---

## Phase 3: Product Management
Branch: `feat/phase-3-products`

### Goal
Users can view, add, and edit their product catalog.

### Dependencies
Phase 2 complete.

### Tasks
- [x] 3.1 Build `GET /api/products` route (list products, filter by active)
- [x] 3.2 Build `POST /api/products` route (add product, duplicate check)
- [x] 3.3 Build `PATCH /api/products` route (update product name/unit, deactivate)
- [x] 3.4 Build products page (`/products`) with product list, add form, edit inline
- [x] 3.5 Create `useProducts` React Query hook

### Acceptance Criteria
- Products page lists all active products from onboarding
- Can add a new product with optional default unit
- Can edit a product's name or unit
- Can deactivate a product (soft delete)
- Duplicate product names are rejected with a clear error
- All queries scoped to the authenticated business

---

## Phase 4: Sales Input (Core Feature)
Branch: `feat/phase-4-sales-input`

### Goal
Users can log daily sales via natural language or manual form, with a confirmation step before saving.

### Dependencies
Phase 3 complete.

### Tasks
- [x] 4.1 Build the sales parser service (`services/sales-parser.ts`) — rule-based NL parsing
- [x] 4.2 Build the product matcher service (`services/product-matcher.ts`) — fuzzy matching
- [x] 4.3 Build `POST /api/sales/parse` route (parse NL text, return structured items)
- [x] 4.4 Build `POST /api/sales` route (save sales entry with items)
- [x] 4.5 Build `GET /api/sales` route (list entries with pagination and date range)
- [x] 4.6 Build `GET /api/sales/[id]` route (single entry)
- [x] 4.7 Build `PUT /api/sales/[id]` route (edit today's entry)
- [x] 4.8 Build sales input page (`/sales`) with dual-mode UI:
  - NL mode: textarea + parse button
  - Manual mode: product list with quantity steppers
  - Tab/toggle to switch modes
- [x] 4.9 Build confirmation sheet (editable parsed results, unmatched product prompts, save button)
- [x] 4.10 Build sales history page (`/sales/history`) with scrollable date-grouped list
- [x] 4.11 Create `useSales` React Query hook

### Acceptance Criteria
- NL input: "sold 20 eggs, 30kg beef" parses into structured items correctly
- Parser matches existing products (exact + fuzzy)
- Unmatched products flagged as "new" with option to add
- Confirmation screen shows editable parsed results
- Saving creates a SalesEntry + SalesItems in DB
- Manual form lists all products with quantity inputs
- Both modes produce the same saved data structure
- Can view sales history grouped by date
- Can edit today's entry
- Sales logging takes < 30 seconds

---

## Phase 5: Dashboard & Analytics
Branch: `feat/phase-5-dashboard`

### Goal
Users see a meaningful home screen with today's summary, weekly trends, and top products.

### Dependencies
Phase 4 complete (needs sales data to display).

### Tasks
- [x] 5.1 Build analytics service (`services/analytics.ts`) — trend calculations, period comparisons, product rankings
- [x] 5.2 Build `GET /api/dashboard` route (aggregated single-call response)
- [x] 5.3 Build dashboard page (`/dashboard`) with card-based layout:
  - Today's Summary card
  - This Week card (with week-over-week comparison)
  - Top Products card
- [x] 5.4 Build empty state for dashboard (no sales data yet — guide user to log first sale)
- [x] 5.5 Create `useDashboard` React Query hook
- [x] 5.6 Build mobile bottom navigation bar (Dashboard / Log Sales / History tabs)

### Acceptance Criteria
- Dashboard shows today's sales summary after logging entries
- Week view shows total quantity and comparison with previous week
- Top products ranked by quantity
- Empty state shown when no sales data exists, with CTA to log first sale
- Bottom nav allows switching between Dashboard, Sales, and History
- Dashboard loads in a single API call
- Mobile-optimized single-column layout

---

## Phase 6: Predictions & Insights
Branch: `feat/phase-6-intelligence`

### Goal
Users see demand predictions and auto-generated business insights on the dashboard.

### Dependencies
Phase 5 complete. Requires 5+ days of sales data for predictions.

### Tasks
- [x] 6.1 Build prediction engine (`services/prediction-engine.ts`) — moving averages + weekday patterns
- [x] 6.2 Build insight generator (`services/insight-generator.ts`) — template-based NL insights
- [x] 6.3 Build `GET /api/predictions` route (next-day and weekly forecasts)
- [x] 6.4 Build `GET /api/insights` route (daily generated insights)
- [x] 6.5 Implement on-demand batch processing in dashboard API (generate if stale > 24h)
- [x] 6.6 Add Tomorrow's Forecast card to dashboard
- [x] 6.7 Add Insights card to dashboard
- [x] 6.8 Show confidence levels on predictions (low/moderate/good/high)
- [x] 6.9 Show "need more data" message when < 5 entries exist
- [x] 6.10 Create `usePredictions` React Query hook

### Acceptance Criteria
- After 5+ sales entries, predictions appear on dashboard
- Next-day forecast shows predicted quantities per product
- Weekly view shows weekday-level breakdown
- Confidence levels displayed and make sense (more data = higher confidence)
- Insights like "Egg sales increased 15% this week" appear
- Insights refresh when stale (> 24 hours)
- Below 5 entries, a "log more data" message is shown instead of predictions

---

## Phase 7: Polish & Launch Prep
Branch: `feat/phase-7-polish`

### Goal
Refine the UI, handle edge cases, add seed data, and prepare for deployment.

### Dependencies
Phase 6 complete.

### Tasks
- [x] 7.1 Mobile UI refinement — touch targets, spacing, responsive tweaks
- [x] 7.2 Loading states (skeletons) for all pages
- [x] 7.3 Error boundaries and fallback UI
- [x] 7.4 Empty states for all sections (no products, no sales, no insights)
- [x] 7.5 Create seed script (`prisma/seed.ts`) with demo business, products, and 14 days of sales data
- [x] 7.6 Add privacy messaging ("Your data is private. BizSense works only for your business.")
- [x] 7.7 Update metadata (title, description, OG tags)
- [x] 7.8 Environment variable validation on startup
- [ ] 7.9 Deployment to Vercel + Neon production database
- [ ] 7.10 Smoke test the deployed app end-to-end

### Acceptance Criteria
- App works smoothly on mobile (iOS Safari, Android Chrome)
- All loading states show skeletons, not blank screens
- Errors show user-friendly messages with retry options
- Seed data demonstrates the full feature set (dashboard, predictions, insights)
- App deployed and accessible via public URL
- Full user flow works: signup → onboarding → log sales → dashboard → predictions

---

## Phase 8: MVP Completion
Branch: `feat/phase-8-mvp-completion`

### Goal
Close the remaining gaps identified during MVP evaluation: password reset, weekly predictions UI, sales entry management, and i18n string externalization.

### Dependencies
Phase 7 complete.

### Tasks

#### 8.1 Password Reset Flow
- [x] 8.1.1 Build `POST /api/auth/forgot-password` route — accepts email, generates a time-limited reset token, stores it in `VerificationToken` table
- [x] 8.1.2 Build `POST /api/auth/reset-password` route — accepts token + new password, validates token expiry, updates password hash
- [x] 8.1.3 Build forgot password page (`/forgot-password`) — email input form, sends reset request
- [x] 8.1.4 Build reset password page (`/reset-password`) — new password form, validates token from URL
- [x] 8.1.5 Add "Forgot password?" link to login page
- [x] 8.1.6 For MVP, log the reset link to console (no email provider needed yet). Document where to plug in an email service later.

#### 8.2 Weekly Predictions Dashboard Card
- [x] 8.2.1 Add "Next Week" card to dashboard — shows weekday-level breakdown per product
- [x] 8.2.2 Fetch weekly predictions from existing `GET /api/predictions?horizon=week` endpoint
- [x] 8.2.3 Display as a compact table or list: day name, predicted quantity per top product
- [x] 8.2.4 Show strongest/weakest day callout (e.g., "Friday is your strongest day for Eggs")

#### 8.3 Sales Entry Deletion
- [x] 8.3.1 Build `DELETE /api/sales/[id]` route — deletes entry and its items, scoped to business
- [x] 8.3.2 Add delete button to each entry in sales history page
- [x] 8.3.3 Add confirmation prompt before deletion ("Delete this entry?")
- [x] 8.3.4 Invalidate dashboard and sales query caches after deletion

#### 8.4 i18n String Externalization
- [x] 8.4.1 Audit all components for hardcoded English strings
- [x] 8.4.2 Replace hardcoded strings with translation keys from `src/messages/en.json`
- [x] 8.4.3 Set up `next-intl` provider in the app layout
- [x] 8.4.4 Update `en.json` with all new keys (dashboard cards, sales input, history, products, onboarding, auth, errors)
- [x] 8.4.5 Verify all pages render correctly with the i18n provider

### Acceptance Criteria
- User can request a password reset from the login page and set a new password
- Dashboard shows a "Next Week" card with weekday-level predictions when 5+ entries exist
- User can delete any sales entry from the history page
- All user-facing strings come from the i18n message file, not hardcoded in components
- Adding a new language requires only a new JSON file, no component changes

---

## Phase Summary

| Phase | Focus | Key Deliverable |
|-------|-------|-----------------|
| 1 | Database & Auth UI | Users can sign up and log in |
| 2 | Onboarding | Business profile + initial products created |
| 3 | Product Management | Full product CRUD |
| 4 | Sales Input | Dual-mode sales logging with NL parser |
| 5 | Dashboard & Analytics | Home screen with summaries and trends |
| 6 | Predictions & Insights | Demand forecasts and auto-generated insights |
| 7 | Polish & Launch | Mobile refinement, seed data, deployment |
| 8 | MVP Completion | Password reset, weekly predictions, entry deletion, i18n |

---

## Post-Phase Fixes & Enhancements

These were implemented after the main phases, addressing bugs and feature gaps discovered during testing.

### Bug Fixes
- [x] Fix dashboard empty state logic — distinguish "never logged" vs "not logged today" (`fix/dashboard-empty-state`)
- [x] Fix timezone mismatch — all date calculations now use business timezone instead of UTC (`fix/timezone-aware-dates`)
- [x] Fix NL parser unit extraction — prevent unit regex matching inside product names like "eggs" (`fix/nl-parser-unit-handling`)
- [x] Fix NL parser unit handling for unmatched products — operator precedence bug in ternary (`fix/nl-parser-unit-handling`)
- [x] Pass parsed unit when adding unmatched products from confirmation screen (`fix/nl-parser-unit-handling`)
- [x] Fix mobile nav — prevent "Log Sales" tab highlighting on history page (`fix/nav-active-state`)
- [x] Fix today's summary to aggregate across multiple daily entries (`feat/multiple-daily-entries`)

### Features Added
- [x] Business timezone field — auto-detected from browser during onboarding (`fix/timezone-aware-dates`)
- [x] Timezone-aware date utility (`src/lib/dates.ts`) used by all services (`fix/timezone-aware-dates`)
- [x] Save original NL text with sales entries for audit trail (`feat/save-raw-nl-input`)
- [x] Display original NL input in sales history (`feat/save-raw-nl-input`)
- [x] Multiple sales entries per day — removed unique constraint, simplified POST API (`feat/multiple-daily-entries`)
- [x] Sales history grouped by date with time display for each entry (`feat/multiple-daily-entries`)
- [x] Warm teal color theme with modern styling (`feat/ui-refresh`)
- [x] Geist Sans font properly connected (`feat/ui-refresh`)
- [x] Cards with subtle shadows, warm off-white background (`feat/ui-refresh`)
- [x] Structured logging across all API routes (`feat/logging`)
- [x] Color-coded log levels with timestamps and context tags (`feat/logging`)

---

## Git Strategy

Each phase gets its own branch off `main`. After completing and verifying a phase:

```
git checkout -b feat/phase-{n}-{name}
# ... implement ...
git add -A
git commit -m "feat: phase {n} — {description}"
# PR → review → merge to main
```

Commit messages follow conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`.
