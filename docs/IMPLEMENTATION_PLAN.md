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
| 9 | Security & Correctness | Critical bug fixes, data integrity, validation |
| 10 | UX Polish | Manual mode improvements, demo data, product list refresh |

---

## Phase 9: Security & Correctness Fixes
Branch: `fix/phase-9-security`

### Goal
Fix all critical and high-priority bugs identified in the code review. Focus on data integrity, security, and correctness.

### Reference
[Bugs & Improvements](./BUGS_AND_IMPROVEMENTS.md) — Section 1

### Tasks
- [x] 9.1 Wrap sales entry update (PUT) in a `$transaction` to prevent data loss (BUG-01)
- [x] 9.2 Verify product ownership before inserting SalesItems in POST /api/sales (BUG-02)
- [x] 9.3 Parse weekday from date string directly instead of relying on JS Date UTC methods (BUG-03)
- [x] 9.4 Use business timezone in the "edit today only" guard in PUT /api/sales/[id] (BUG-04)
- [x] 9.5 Add `@@unique([businessId, date, type])` constraint on DailyInsight to prevent duplicates (BUG-05)
- [x] 9.6 Fix token race condition in reset-password — delete token before updating password (BUG-06)
- [x] 9.7 Filter out zero-quantity items before saving in the confirmation screen (BUG-09)
- [x] 9.8 Validate IANA timezone string server-side in POST /api/business (BUG-12)
- [x] 9.9 Rename `tomorrowDate` to `todayUpperBound` in analytics for clarity (IMPROVE-02)
- [x] 9.10 Extract confidence threshold magic numbers to named constants (IMPROVE-04)

### Acceptance Criteria
- Sales entry updates are atomic — partial failures cannot leave entries without items
- Product IDs are verified against the business before any SalesItem is created
- Weekday patterns in predictions are correct regardless of user timezone
- Users in UTC+ timezones can edit today's entries in the morning
- Concurrent dashboard loads do not create duplicate insights
- Zero-quantity items cannot be saved
- Invalid timezone strings are rejected during onboarding

---

## Phase 10: UX Polish & Missing Features
Branch: `feat/phase-10-ux-polish`

### Goal
Close remaining UX gaps and add small features that improve the new-user experience.

### Reference
[Bugs & Improvements](./BUGS_AND_IMPROVEMENTS.md) — Sections 2 & 3

### Tasks
- [x] 10.1 Fix manual tab product list to refresh when products change during the session (BUG-08)
- [x] 10.2 Add inline "Add new product" button in manual entry mode (MISSING-01)
- [x] 10.3 Add "Load demo data" button on empty dashboard for new users (MISSING-03)

### Acceptance Criteria
- Adding a product via NL mode is immediately reflected in the manual tab
- Manual entry mode has an inline "Add product" option without navigating away
- New users can load demo data to see the full dashboard experience before logging real sales

---

## Deferred Items

These were identified in the code review but deferred from the current MVP scope:

| Item | Reason | When to revisit |
|------|--------|-----------------|
| BUG-07: Rate limiting on auth endpoints | Requires external dependency (Upstash) | Before public launch |
| BUG-10: Forecast status field for error states | Nice-to-have; silent fallback is acceptable | Post-launch polish |
| BUG-11: Placeholder insight IDs | No user impact currently | When insight IDs are referenced in code |
| IMPROVE-01: Email delivery for password reset | Blocking for real users but not for MVP testing | Before first real user onboards |
| IMPROVE-03: Levenshtein optimization (two-row) | Premature; product lists are small (<50 items) | If product catalogs grow significantly |
| MISSING-02: Locale step in onboarding | No value with single language; i18n architecture is ready | When second language is added |

---

## Post-MVP Roadmap

### Phase 11: PWA Support
Branch: `feat/phase-11-pwa`

Make BizSense installable as a standalone app on mobile devices.

#### Tasks
- [x] 11.1 Create `public/manifest.json` with app name, short name, theme color (teal), background color, display: standalone, start_url: /dashboard
- [x] 11.2 Generate app icons in required sizes (192x192, 512x512, maskable) from the BizSense logo/icon
- [x] 11.3 Add `<link rel="manifest">` and meta tags (theme-color, apple-mobile-web-app-capable) to root layout
- [x] 11.4 Create a basic service worker for app shell caching (offline fallback page)
- [x] 11.5 Add apple-touch-icon for iOS home screen
- [x] 11.6 Test "Add to Home Screen" on iOS Safari and Android Chrome
- [x] 11.7 Verify standalone mode launches without browser chrome

#### Acceptance Criteria
- App is installable via browser "Add to Home Screen" prompt
- Launches in standalone mode (no URL bar)
- Has proper app icon and splash screen
- Shows an offline fallback page when network is unavailable

---

### Phase 12: Email Infrastructure
Branch: `feat/phase-12-email`

Wire up real email delivery. Required before LLM integration (for weekly summaries later).

#### Tasks
- [ ] 12.1 Set up Resend account and get API key
- [ ] 12.2 Create `src/lib/email.ts` utility with `sendEmail(to, subject, html)` function
- [ ] 12.3 Replace console.log in forgot-password route with actual email delivery
- [ ] 12.4 Create a simple HTML email template for password reset
- [ ] 12.5 Add `RESEND_API_KEY` to environment variables
- [ ] 12.6 Test full password reset flow end-to-end with real email

#### Acceptance Criteria
- Password reset emails are delivered to real inboxes
- Email has clean HTML template with reset link
- Works in production (Vercel)

---

### Phase 13: LLM-Powered Insights
Branch: `feat/phase-13-llm-insights`

Upgrade the template-based insight generator to use an LLM for more natural, varied, and contextual insights.

#### Tasks
- [ ] 13.1 Create `src/lib/openai.ts` utility with a `generateCompletion(prompt, systemMessage)` function
- [ ] 13.2 Design the insight generation prompt — feed it the analytics data (weekly totals, trends, top products, weekday patterns) and ask for 3-5 natural language insights
- [ ] 13.3 Add a `generationMethod` field to DailyInsight model: `"template" | "llm"`
- [ ] 13.4 Update insight generator to try LLM first, fall back to templates if API fails or is unavailable
- [ ] 13.5 Add `OPENAI_API_KEY` to environment variables
- [ ] 13.6 Implement response caching — store LLM-generated insights in DB, don't re-call for the same day
- [ ] 13.7 Add cost guard — limit LLM calls to once per business per day maximum
- [ ] 13.8 Test with real data: compare LLM insights vs template insights for quality

#### Acceptance Criteria
- Dashboard insights are more natural and varied than templates ("Your egg sales have been climbing steadily — up 23% from last week" vs "Egg sales increased 23% this week")
- LLM failures fall back gracefully to template-based insights
- No more than 1 API call per business per day
- Insights are cached in DB and served from cache on subsequent loads

---

### Phase 14: AI Chat Interface
Branch: `feat/phase-14-ai-chat`

Let users ask business questions in natural language and get answers based on their own data.

#### Tasks
- [ ] 14.1 Create `POST /api/chat` route — accepts a user message, queries relevant business data, sends to LLM with context
- [ ] 14.2 Build the data context builder — given a user question, determine which analytics to query (today's sales, weekly trends, product history, predictions) and format as LLM context
- [ ] 14.3 Design the system prompt — constrain the LLM to only answer based on the user's data, no external assumptions
- [ ] 14.4 Build chat UI page (`/chat`) with message list and input field
- [ ] 14.5 Add chat to the mobile navigation bar
- [ ] 14.6 Implement conversation history (store last N messages in session/state, not DB for MVP)
- [ ] 14.7 Add suggested questions on empty chat ("What sold best this week?", "When should I prepare more chicken?", "How did eggs perform this month?")
- [ ] 14.8 Add streaming response support for better UX (show tokens as they arrive)

#### Acceptance Criteria
- User can ask "What sold best this week?" and get an accurate answer from their data
- User can ask "When should I prepare more chicken?" and get a prediction-based answer
- Responses are constrained to the user's own data (no hallucinated external info)
- Suggested questions help new users discover the feature
- Chat feels responsive (streaming or fast response)

---

### Phase 15: Production Hardening
Branch: `feat/phase-15-production`

Security and reliability improvements for real-world usage.

#### Tasks
- [ ] 15.1 Add rate limiting on auth endpoints (Upstash Ratelimit)
- [ ] 15.2 Add account and data deletion (`DELETE /api/account` with cascade)
- [ ] 15.3 Add settings/profile page with logout, delete account, timezone change
- [ ] 15.4 Add CSV export of sales history (`GET /api/sales/export`)
- [ ] 15.5 Add demand spike alert card on dashboard (>30% above average)
- [ ] 15.6 Add unit selector override per sale entry in manual mode

#### Acceptance Criteria
- Auth endpoints are rate-limited (3 forgot-password per email per hour, 10 signups per IP per hour)
- Users can delete their account and all associated data
- Users can export their sales data as CSV
- Dashboard highlights unusual demand spikes proactively

---

### Phase Summary (Full Roadmap)

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Database & Auth UI | ✅ Complete |
| 2 | Onboarding | ✅ Complete |
| 3 | Product Management | ✅ Complete |
| 4 | Sales Input | ✅ Complete |
| 5 | Dashboard & Analytics | ✅ Complete |
| 6 | Predictions & Insights | ✅ Complete |
| 7 | Polish & Launch | ✅ Complete |
| 8 | MVP Completion | ✅ Complete |
| 9 | Security & Correctness | ✅ Complete |
| 10 | UX Polish | ✅ Complete |
| 11 | PWA Support | Planned |
| 12 | Email Infrastructure | Planned |
| 13 | LLM-Powered Insights | Planned |
| 14 | AI Chat Interface | Planned |
| 15 | Production Hardening | Planned |

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
