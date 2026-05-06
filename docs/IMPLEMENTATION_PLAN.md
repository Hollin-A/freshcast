# Freshcast — Implementation Plan

This document tracks the phased implementation of Freshcast MVP. Each phase has clear deliverables, acceptance criteria, and a dependency chain. Phases are designed to be independently testable — you verify each one works before moving to the next.

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

## Phase Summary

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
| 11 | PWA Support | ✅ Complete |
| 12 | Email Infrastructure | ✅ Complete |
| 13 | LLM Integration (Claude) | ✅ Complete |
| 14 | AI Chat Interface | ✅ Complete |
| 15 | Production Hardening | ✅ Complete |
| 16 | Auth UX Polish | ✅ Complete |
| 17 | Loading & Splash States | ✅ Complete |
| 18 | Prediction Data Progress | ✅ Complete |
| 19 | NL Parser Improvements | ✅ Complete |
| 20 | Holiday-Aware Predictions | ✅ Complete |
| 21 | Editorial Rebrand | ✅ Complete |
| 22 | Post-Rebrand Enhancements | ✅ Complete |
| 23 | Demo Security & Rate Limiting | ✅ Complete |
| 24 | Unit Testing Foundation | ✅ Complete |
| 25 | Sales Input UX Improvements | ✅ Complete |
| 26 | Production Foundations | ✅ Complete |
| 27 | AWS Amplify Deployment | ✅ Complete |
| 28 | AWS Email & Scheduling | 🟡 In progress |
| 29 | Receipt Upload & OCR | ✅ Complete |
| 30 | Observability & API Maturity | 🔲 Not started |
| 31 | Push Notifications | 🔲 Not started |
| 32 | Frontend Polish | 🔲 Not started |
| 33 | Advanced AWS & Infrastructure | 🔲 Not started |
| 34 | NL Parser Evaluation Framework | 🔲 Not started |
| 35 | Voice Input (Amazon Transcribe) | 🔲 Not started |
| 36 | Receipt OCR Hardening | 🟡 In progress |

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
- [x] 7.6 Add privacy messaging ("Your data is private. Freshcast works only for your business.")
- [x] 7.7 Update metadata (title, description, OG tags)
- [x] 7.8 Environment variable validation on startup
- [x] 7.9 Deployment to Vercel + Neon production database
- [x] 7.10 Smoke test the deployed app end-to-end

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

These were identified in the code review but deferred from the current scope:

| Item | Reason | When to revisit |
|------|--------|-----------------|
| BUG-10: Forecast status field for error states | Nice-to-have; silent fallback is acceptable | Post-launch polish |
| MISSING-02: Locale step in onboarding | No value with single language; i18n architecture is ready | When second language is added |
| Streaming chat responses | Current non-streaming approach is acceptable for Haiku speed | When chat usage grows |

Items previously deferred but now implemented: rate limiting (Phase 15), email delivery (Phase 12), placeholder insight IDs (fixed in Phase 9), Levenshtein optimization (deferred — still acceptable).

---

---

## Phase 11: PWA Support
Branch: `feat/phase-11-pwa`

Make Freshcast installable as a standalone app on mobile devices.

### Tasks
- [x] 11.1 Create `public/manifest.json` with app name, short name, theme color (teal), background color, display: standalone, start_url: /dashboard
- [x] 11.2 Generate app icons in required sizes (192x192, 512x512, maskable) from the Freshcast logo/icon
- [x] 11.3 Add `<link rel="manifest">` and meta tags (theme-color, apple-mobile-web-app-capable) to root layout
- [x] 11.4 Create a basic service worker for app shell caching (offline fallback page)
- [x] 11.5 Add apple-touch-icon for iOS home screen
- [x] 11.6 Test "Add to Home Screen" on iOS Safari and Android Chrome
- [x] 11.7 Verify standalone mode launches without browser chrome

### Acceptance Criteria
- App is installable via browser "Add to Home Screen" prompt
- Launches in standalone mode (no URL bar)
- Has proper app icon and splash screen
- Shows an offline fallback page when network is unavailable

---

## Phase 12: Email Infrastructure
Branch: `feat/phase-12-email`

Wire up real email delivery. Required before LLM integration (for weekly summaries later).

### Tasks
- [x] 12.1 Set up Resend account and get API key
- [x] 12.2 Create `src/lib/email.ts` utility with `sendEmail(to, subject, html)` function
- [x] 12.3 Replace console.log in forgot-password route with actual email delivery
- [x] 12.4 Create a simple HTML email template for password reset
- [x] 12.5 Add `RESEND_API_KEY` to environment variables
- [x] 12.6 Test full password reset flow end-to-end with real email

### Acceptance Criteria
- Password reset emails are delivered to real inboxes
- Email has clean HTML template with reset link
- Works in production (Vercel)

---

## Phase 13: LLM Integration (Claude Haiku)
Branch: `feat/phase-13-llm`

Integrate Claude 3.5 Haiku for two upgrades: smarter NL sales parsing and more natural dashboard insights. Both use the same Claude client with graceful fallback to existing rule-based/template logic.

Model: `claude-3-5-haiku-latest` (~$0.80/M input, $3.20/M output — pennies per month for a single-user app)

### Tasks

##### 13A — Claude Client Setup
- [x] 13.1 Install `@anthropic-ai/sdk`
- [x] 13.2 Create `src/lib/claude.ts` utility with `generateText(systemPrompt, userMessage)` function
- [x] 13.3 Add `ANTHROPIC_API_KEY` to environment variables (local + Vercel)

##### 13B — LLM-Powered Insights
- [x] 13.4 Design the insight generation prompt — feed analytics data (weekly totals, trends, top products, weekday patterns) and ask for 3-5 natural language insights as JSON
- [x] 13.5 Add `generationMethod` field to DailyInsight model: `"template" | "llm"`
- [x] 13.6 Update insight generator: try Claude first, fall back to templates if API fails or key is missing
- [x] 13.7 Cache LLM insights in DB — don't re-call for the same day (existing dedup logic handles this)
- [x] 13.8 Cost guard — max 1 LLM insight call per business per day

##### 13C — LLM-Powered NL Sales Parser
- [x] 13.9 Design the sales parsing prompt — given raw text + product list, return structured JSON with product name, quantity, unit, and matched/unmatched status
- [x] 13.10 Create `src/services/llm-sales-parser.ts` that calls Claude and returns the same `ParsedItem[]` format as the rule-based parser
- [x] 13.11 Update `POST /api/sales/parse` to try LLM parser first, fall back to rule-based if API fails or key is missing
- [x] 13.12 Add `parseMethod` field to the parse response: `"rule-based" | "llm"` so the UI can indicate which method was used
- [x] 13.13 Test with edge cases the rule-based parser struggles with: "about two dozen eggs", "sold some beef maybe 30 kilos", "10 of each chicken and lamb"

### Acceptance Criteria
- Dashboard insights are more natural and varied when Claude is available
- NL parser handles ambiguous/conversational input that the rule-based parser misses
- Both features fall back gracefully when the API key is missing or the API is down
- Rule-based parser still works perfectly as the fallback
- No more than 1 insight generation call per business per day
- Parse calls use Claude when available (each parse is a separate call — acceptable at Haiku pricing)
- The parse response indicates which method was used

---

## Phase 14: AI Chat Interface
Branch: `feat/phase-14-ai-chat`

Let users ask business questions in natural language and get answers based on their own data. Uses the same Claude client from Phase 13.

### Tasks
- [x] 14.1 Create `POST /api/chat` route — accepts a user message, queries relevant business data, sends to Claude with context
- [x] 14.2 Build the data context builder — given a user question, determine which analytics to query (today's sales, weekly trends, product history, predictions) and format as Claude context
- [x] 14.3 Design the system prompt — constrain Claude to only answer based on the user's data, no external assumptions
- [x] 14.4 Build chat UI page (`/chat`) with message list and input field
- [x] 14.5 Add chat to the mobile navigation bar
- [x] 14.6 Implement conversation history (store last N messages in session/state, not DB for now)
- [x] 14.7 Add suggested questions on empty chat ("What sold best this week?", "When should I prepare more chicken?", "How did eggs perform this month?")
- [ ] 14.8 Add streaming response support for better UX (show tokens as they arrive)

### Acceptance Criteria
- User can ask "What sold best this week?" and get an accurate answer from their data
- User can ask "When should I prepare more chicken?" and get a prediction-based answer
- Responses are constrained to the user's own data (no hallucinated external info)
- Suggested questions help new users discover the feature
- Chat feels responsive (streaming or fast response)

---

## Phase 15: Production Hardening
Branch: `feat/phase-15-production`

Security and reliability improvements for real-world usage.

### Tasks
- [x] 15.1 Add rate limiting on auth endpoints (Upstash Ratelimit)
- [x] 15.2 Add account and data deletion (`DELETE /api/account` with cascade)
- [x] 15.3 Add settings/profile page with logout, delete account, timezone change
- [x] 15.4 Add CSV export of sales history (`GET /api/sales/export`)
- [x] 15.5 Add demand spike alert card on dashboard (>30% above average)
- [x] 15.6 Add unit selector override per sale entry in manual mode

### Acceptance Criteria
- Auth endpoints are rate-limited (3 forgot-password per email per hour, 10 signups per IP per hour)
- Users can delete their account and all associated data
- Users can export their sales data as CSV
- Dashboard highlights unusual demand spikes proactively

---

## Phase 16: Auth UX Polish
Branch: `feat/phase-16-auth-ux`

### Goal
Fix visual issues on auth pages and add email verification for a complete auth lifecycle.

### Tasks
- [x] 16.1 Fix padding on login/signup/reset password cards — bottom of card clips after last input field
- [x] 16.2 Add show/hide password toggle (eye icon) on all password input fields (login, signup, reset password)
- [x] 16.3 Build email verification flow:
  - On signup, send a verification email with a unique link via Resend
  - `POST /api/auth/verify-email` endpoint — validates token, sets `emailVerified` on User
  - Verification page (`/verify-email`) that handles the link click
- [x] 16.4 Create teal-themed verification email template (consistent with password reset email)
- [x] 16.5 Show verification status in settings page ("Email verified ✓" or "Not verified — Send verification email")
- [x] 16.6 Email verification is optional — users can use the app without verifying

### Acceptance Criteria
- Auth page cards have proper bottom padding, no clipping
- Password fields have a toggle to show/hide the password
- New users receive a verification email on signup
- Clicking the verification link marks the email as verified
- Settings page shows verification status with option to resend

---

## Phase 17: Loading & Splash States
Branch: `feat/phase-17-loading`

### Goal
Add a branded splash screen for initial app load and ensure all pages have proper loading states.

### Tasks
- [x] 17.1 Create root-level `loading.tsx` splash screen — app icon centered on teal background, references `public/icons/` so icon changes propagate
- [x] 17.2 Audit and add missing loading skeletons:
  - Chat page (currently no skeleton)
  - Settings page (currently no loading state)
  - Sales input page (while products load)
- [x] 17.3 Ensure auth pages don't show splash (they're static, no loading needed)

### Acceptance Criteria
- First app load shows branded splash with app icon (not blank white screen)
- Changing the icon file in `public/icons/` updates the splash automatically
- All dynamic pages show skeletons while data loads
- No blank screens during navigation

---

## Phase 18: Prediction Data Progress Bar
Branch: `feat/phase-18-prediction-progress`

### Goal
Show users how close they are to unlocking and improving predictions, motivating continued data entry.

### Tasks
- [x] 18.1 Build multi-tier progress indicator component with 4 levels:
  - 🔴 0–4 entries: "Log 5 days to unlock predictions"
  - 🟡 5–14 entries: "Basic predictions active"
  - 🟢 15–29 entries: "Predictions improving"
  - 🔵 30+ entries: "Predictions are reliable"
- [x] 18.2 Place at top of dashboard (below business name, above forecast card)
- [x] 18.3 Auto-hide when user reaches 30+ entries (reliable tier)
- [x] 18.4 Use `totalEntries` from existing dashboard API response (no backend changes)

### Acceptance Criteria
- New users see the progress bar guiding them to log 5 days
- Progress bar updates as entries are added
- Each tier has a distinct color and label
- Bar disappears once predictions are fully reliable (30+ entries)
- Frontend-only — no API changes needed

---

## Phase 19: NL Parser Improvements
Branch: `feat/phase-19-parser-improvements`

### Goal
Improve LLM parsing accuracy with unit normalization and ambiguous quantity detection.

### Tasks
- [x] 19.1 Unit normalization:
  - Update LLM prompt to specify exact accepted unit strings from `KNOWN_UNITS`
  - Add post-processing normalizer on LLM response (e.g., "Litre" → "liters", "L" → "liters", "Kg" → "kg")
  - Ensure consistent units stored in database regardless of how user types them
- [x] 19.2 Ambiguous quantity detection:
  - Update LLM prompt to return `status: "ok" | "ambiguous"` per item
  - Add optional `clarification` field (e.g., "You said 'few' — how many exactly?")
  - Update `ParsedItem` type with `status` and `clarification` fields
- [x] 19.3 Update confirmation screen UI:
  - Ambiguous items shown with yellow/amber highlight
  - Clarification message displayed below the item
  - Quantity field auto-focused for user to fill in
  - Cannot save until all ambiguous items have a valid quantity
- [x] 19.4 Update rule-based fallback parser to also normalize units (for consistency when LLM is unavailable)

### Acceptance Criteria
- "2L milk" and "2 litres milk" both normalize to unit "liters" in the database
- "12 kg beef and few eggs" → beef parsed normally, eggs flagged as ambiguous with clarification
- User must resolve ambiguous quantities before saving
- Unit normalization works for both LLM and rule-based parsers

---

## Phase 20: Holiday-Aware Predictions
Branch: `feat/phase-20-holiday-predictions`

### Goal
Adjust demand predictions based on public holidays for the business's region.

### Tasks
- [x] 20.1 Add `region` field to Business model (default: `"AU-VIC"`, set during onboarding)
- [x] 20.2 Create `src/data/holidays.ts` — Victoria public holidays for 2026–2027 with type classification:
  - `closed`: most retail closed (Christmas, Good Friday) → multiplier 0.3
  - `low`: reduced traffic (Anzac Day morning, Boxing Day) → multiplier 0.6
  - `pre-holiday`: day before a holiday → multiplier 1.2
  - `post-holiday`: day after long weekend → multiplier 1.1
- [x] 20.3 Update prediction engine: check if forecast date is a holiday, apply multiplier to base prediction
- [x] 20.4 Show holiday indicator on forecast card (e.g., "📅 Public holiday tomorrow — expect lower sales")
- [x] 20.5 Auto-detect region during onboarding (default AU-VIC, stored as variable for future expansion)

### Acceptance Criteria
- Predictions for Christmas Day are ~70% lower than normal
- Day before Easter shows ~20% higher prediction
- Forecast card shows a holiday label when applicable
- Region is configurable per business (defaults to AU-VIC)
- Holiday data is a simple data file, easy to add new regions

---

## Phase 21: Editorial Rebrand
Branch: `feat/rebrand-editorial`

### Goal
Replace the current teal/Geist theme with a warm editorial design language — cream backgrounds, terracotta accents, Fraunces serif headings, and earthy tones. Pure UI refresh, no business logic changes.

### Reference
Design source: `docs/rebranding/` (exported from Claude Design)
ADR: [016-editorial-rebrand](./adr/016-editorial-rebrand.md)

### Dependencies
All previous phases complete. No API or data model changes required.

---

#### 21.1 Design Tokens & Global Theme

##### Tasks
- [x] 21.1.1 Add Fraunces (serif) and JetBrains Mono fonts to `layout.tsx` via `next/font/google`
- [x] 21.1.2 Replace CSS custom properties in `globals.css` with the warm editorial palette:
  - Backgrounds: cream `#F5EFE3`, paper `#FAF6EC`, shell `#EFE6D4`
  - Ink: `#1E1A14`, body `#3B342A`, muted `#7A6F5E`
  - Accents: terra `#B5553A`, olive `#6B7A3A`, harvest `#C69840`, clay `#D48A5E`, plum `#6E3A4A`, sage `#C7CDA8`
  - Semantic: good (olive), warn (harvest), bad (terra)
- [x] 21.1.3 Update Tailwind theme to expose new color tokens (terra, olive, harvest, clay, plum, sage, cream, paper, shell, ink)
- [x] 21.1.4 Add `--font-serif` CSS variable and Tailwind `font-serif` utility
- [x] 21.1.5 Update `themeColor` in viewport metadata from `#2a9d8f` to `#F5EFE3`
- [x] 21.1.6 Update PWA manifest theme/background colors

##### Acceptance Criteria
- App background is cream, cards are paper-white
- Serif font (Fraunces) loads and is available via `font-serif` class
- Monospace font (JetBrains Mono) replaces Geist Mono
- All existing shadcn components pick up new colors via CSS variables
- No visual regressions in component rendering

---

#### 21.2 Shared UI Primitives

##### Tasks
- [x] 21.2.1 Restyle `button.tsx` — terracotta primary (pill shape, `rounded-full`), shell secondary, ghost, dark variants
- [x] 21.2.2 Restyle `card.tsx` — paper background, warm border (`#E4D9C1`), `rounded-2xl` (18px)
- [x] 21.2.3 Restyle `input.tsx` and `password-input.tsx` — paper bg, terra focus ring, uppercase labels
- [x] 21.2.4 Restyle `badge.tsx` — pill tags with tone variants (terra, olive, gold, plum, muted, ink)
- [x] 21.2.5 Restyle `tabs.tsx` — shell background toggle with paper active state
- [x] 21.2.6 Update `mobile-nav.tsx` — 5-tab bar (Today, Log, History, Ask, More), terra active state, frosted glass backdrop
- [x] 21.2.7 Add section label component (uppercase, small, muted, with optional trailing action)
- [x] 21.2.8 Add big number component (serif font, large size, with optional unit and trend)

##### Acceptance Criteria
- Buttons are pill-shaped with terracotta primary
- Cards have warm paper background and subtle borders
- Inputs have terra focus ring with uppercase labels
- Tab bar has 5 items with correct active states
- All primitives match the design file proportions and colors

---

#### 21.3 Auth Screens

##### Tasks
- [x] 21.3.1 Build `AuthShell` layout — logo top-left, decorative gradient background, large serif title, subtitle, footer links
- [x] 21.3.2 Restyle login page — "Welcome back." serif heading, warm input fields, terracotta CTA
- [x] 21.3.3 Restyle signup page — "Stock smarter, starting tomorrow." heading, privacy note footer
- [x] 21.3.4 Restyle reset password page — clean single-field layout with back link
- [x] 21.3.5 Update auth layout background from white to cream with subtle radial gradients

##### Acceptance Criteria
- Auth pages have editorial feel with serif headings
- Terracotta primary button on all auth forms
- Logo (sprout mark + wordmark) visible at top
- Decorative background gradients (subtle terra + olive)
- Footer links styled consistently

---

#### 21.4 Onboarding Screens

##### Tasks
- [x] 21.4.1 Build onboarding shell — step counter, progress dots (terra fill), back/skip navigation
- [x] 21.4.2 Restyle Step 1 (business name + type) — serif heading, business type tile grid with emoji icons, ink selected state
- [x] 21.4.3 Restyle Step 2 (starter products) — product rows with unit tags, dashed add button, suggested products as pills
- [x] 21.4.4 Restyle Step 3 (you're set) — numbered steps card with terra circles, "Log my first sale" CTA

##### Acceptance Criteria
- Progress dots fill with terra as steps complete
- Business type tiles use emoji icons with ink background when selected
- Product list has removable items with unit tags
- Final step shows clear "what happens next" guidance

---

#### 21.5 Home / Dashboard

##### Tasks
- [x] 21.5.1 Restyle top bar — greeting + business name in serif, avatar circle
- [x] 21.5.2 Build forecast hero card — dark background (`#1E1A14`), clay accents, product rows with mini sparklines, "Use as prep list" CTA
- [x] 21.5.3 Restyle today status card — "You haven't logged yet" prompt with terra Log button
- [x] 21.5.4 Build week rhythm card — bar chart with terra peak highlight, serif headline ("Friday is your biggest day again"), olive trend tag
- [x] 21.5.5 Restyle top products card — horizontal progress bars (terra/clay/harvest gradient), mono quantities
- [x] 21.5.6 Restyle insights card — colored left-border accents (olive/terra/harvest), serif headlines, "What Freshcast noticed" header
- [x] 21.5.7 Restyle prediction progress bar with warm palette
- [x] 21.5.8 Restyle spike alert card with warm palette

##### Acceptance Criteria
- Forecast hero is the dominant card with dark background
- Week chart highlights peak day in terra
- Top products show colored progress bars
- Insights have colored left borders matching their tone
- Overall dashboard feels warm and editorial

---

#### 21.6 Log Sales Screens

##### Tasks
- [x] 21.6.1 Restyle NL input — terra-bordered bubble, highlighted parsed entities (olive for matched, gold for new), bottom input dock with voice mic button
- [x] 21.6.2 Build parsed preview section — green dot indicator, "Freshcast understood" header, parsed item rows with checkmark/plus icons
- [x] 21.6.3 Add recent logs chips section (italic serif, paper background)
- [x] 21.6.4 Restyle manual mode — product rows with +/- steppers (terra plus, shell minus), running total card
- [x] 21.6.5 Restyle review screen — quoted raw input with clay left border, parsed items list, olive "once saved" confirmation card
- [x] 21.6.6 Restyle log tabs — shell background toggle (matches design tab component)

##### Acceptance Criteria
- NL input has terra border with entity highlighting
- Parsed items show matched (checkmark) vs new (plus) status
- Manual mode has clean stepper rows with running total
- Review screen shows original text and parsed breakdown
- Both modes accessible via tab toggle

---

#### 21.7 Remaining Screens

##### Tasks
- [x] 21.7.1 Restyle sales history — streak strip card, entry cards with raw NL quote (clay left border), method tags (terra for NL, olive for manual), date group headers in serif
- [x] 21.7.2 Restyle products page — product cards with colored left bars, search/add bar, suggested products as pills
- [x] 21.7.3 Restyle chat page — dark user bubbles, paper bot bubbles with terra tag, suggested prompt pills, terra send button
- [x] 21.7.4 Restyle settings page — dark business card header with terra avatar, grouped setting rows with emoji icons, olive toggles

##### Acceptance Criteria
- History entries show raw NL text in styled quote blocks
- Product cards have colored accent bars
- Chat has clear visual distinction between user and bot messages
- Settings has grouped sections with consistent row styling

---

#### 21.8 Forecast Detail Screen

##### Tasks
- [x] 21.8.1 Build 14-day bar chart (7 past + 7 forecast) — solid ink bars for actual, hatched terra bars for forecast, dashed divider
- [x] 21.8.2 Build "Why this number" breakdown card — key-value rows (7-day avg, weekday multiplier, holiday, confidence)
- [x] 21.8.3 Build prep plan card — dark header with clay accent, quantity + buffer suggestion, "Add to prep list" CTA

##### Acceptance Criteria
- Chart clearly distinguishes past (solid) from forecast (hatched)
- Tomorrow's bar is labeled and highlighted
- Breakdown explains the prediction factors
- Prep plan gives actionable quantity with buffer

---

### Phase 21 Acceptance Criteria (Overall)
- All screens match the design files in `docs/rebranding/project/`
- No business logic, API routes, or data model changes
- App remains fully functional — all existing features work as before
- Mobile-first responsive layout maintained
- i18n strings still externalized (update keys if label text changes)
- PWA still works (manifest colors updated)

---

## Phase 22: Post-Rebrand Enhancements
Branch: `feat/phase-22-post-rebrand`

### Goal
Close the remaining gaps between the design mockups and the implemented UI. Expand APIs where needed to provide richer data for the dashboard, forecast detail, and products screens. Add weekly summary email.

### Dependencies
Phase 21 complete.

---

#### 22.1 Minor UI Fixes (No API Changes)

##### Tasks
- [x] 22.1.1 Show `lastUpdated` timestamp on the insights card ("updated 7:12am" style)
- [x] 22.1.2 Add holiday region row to settings page (read existing `region` field from Business model)

##### Acceptance Criteria
- Insights card shows when insights were last generated
- Settings page shows the holiday region (e.g., "AU-VIC") in the Business section

---

#### 22.2 Dashboard API Expansion

Expand `GET /api/dashboard` and the prediction engine to return richer per-product data.

##### Tasks
- [x] 22.2.1 Add `getProductDailyHistory(businessId, timezone, days)` to analytics service — returns per-product daily quantities for the last N days
- [x] 22.2.2 Compute per-product 7-day average and week-over-week trend percentage in the analytics service
- [x] 22.2.3 Expand `predictNextDay` return type to include prediction breakdown: `weekdayAvg`, `recentAvg`, `weekdayWeight`, `recentWeight`, `holidayMultiplier`
- [x] 22.2.4 Update `GET /api/dashboard` response to include:
  - `forecast.predictions[].weekdayAvg` — average for same weekday
  - `forecast.predictions[].recentAvg` — 7-day average
  - `forecast.predictions[].trend` — percentage change vs 7-day avg (e.g., "+24%")
  - `forecast.predictions[].pastWeek` — array of 7 daily quantities (for sparklines)
  - `forecast.predictions[].breakdown` — `{ weekdayAvg, recentAvg, holidayMultiplier }`
- [x] 22.2.5 Update `DashboardData` TypeScript type in `use-dashboard.ts` to match new response shape

##### Acceptance Criteria
- Dashboard API returns per-product sparkline data (7 daily values)
- Dashboard API returns per-product trend percentage and 7-day average
- Prediction breakdown factors are included in the response
- Existing dashboard functionality is not broken

---

#### 22.3 Dashboard UI Updates

Use the expanded API data from 22.2 to match the design mockups.

##### Tasks
- [x] 22.3.1 Add mini sparklines (7 tiny bars) per product row in the forecast hero card
- [x] 22.3.2 Add "vs 7d avg" label and trend percentage (e.g., "+24%") per product in forecast hero
- [x] 22.3.3 Add contextual subtitle to forecast hero ("Market day — expect X% above average") computed from the average trend across top products
- [x] 22.3.4 Add "Use as prep list" button — formats forecast as text list and copies to clipboard
- [x] 22.3.5 Add "Share" button — uses Web Share API (`navigator.share`) with forecast text, falls back to clipboard copy on desktop

##### Acceptance Criteria
- Each product in the forecast hero shows a 7-bar sparkline and trend percentage
- Forecast hero has a contextual subtitle based on overall trend
- "Use as prep list" copies a formatted prep list to clipboard with toast confirmation
- "Share" opens the native share sheet on mobile, copies on desktop

---

#### 22.4 Forecast Detail Enhancements

Upgrade the forecast detail overlay to show the full 14-day chart and prediction breakdown.

##### Tasks
- [x] 22.4.1 Pass per-product past-7-day data (from 22.2) into the forecast detail component
- [x] 22.4.2 Build the 14-day bar chart — 7 solid ink bars (actual past) + 7 hatched terra bars (forecast) with dashed divider between them
- [x] 22.4.3 Show "Why this number" breakdown using prediction factors: 7-day average, weekday multiplier, holiday multiplier, confidence with entry count
- [x] 22.4.4 Update prep plan card to show ±buffer suggestion based on variance

##### Acceptance Criteria
- Chart clearly distinguishes past (solid ink) from forecast (hatched terra)
- Dashed vertical divider separates past and future
- Tomorrow's bar is labeled with quantity
- Breakdown card shows the actual contributing factors from the prediction engine
- Prep plan suggests a buffer amount

---

#### 22.5 Products Page Analytics

Add per-product statistics to the products page.

##### Tasks
- [x] 22.5.1 Expand `GET /api/products` response to include per-product analytics: `avgPerDay` (7-day average), `trend` (week-over-week percentage change)
- [x] 22.5.2 Update products client UI to show "avg X unit/day · +Y%" below each product name (matching the design's product card layout)
- [x] 22.5.3 Update `useProducts` hook TypeScript type to include analytics fields

##### Acceptance Criteria
- Each product card shows daily average and trend percentage
- Trend is color-coded (olive for positive, terra for negative)
- Products with no sales data show no analytics (graceful empty state)

---

#### 22.6 Weekly Summary Email

Add opt-in weekly email summarizing the past week's sales and next week's forecast.

##### Tasks
- [x] 22.6.1 Add `weeklyEmailEnabled` boolean field to Business model (default: false), run Prisma migration
- [x] 22.6.2 Add toggle row in settings page for "Weekly summary email" (reads/writes the new field via `PATCH /api/business`)
- [x] 22.6.3 Build `buildWeeklySummaryEmail(businessId)` function — queries last week's sales totals, top products, and next week's forecast, returns HTML email
- [x] 22.6.4 Create warm editorial HTML email template matching the app's design language
- [x] 22.6.5 Build `POST /api/email/weekly-summary` endpoint — generates and sends the weekly email for a given business
- [x] 22.6.6 Add Vercel Cron job (`vercel.json` cron config) to trigger weekly emails every Monday at 6:00 AM for businesses with `weeklyEmailEnabled = true`

##### Acceptance Criteria
- Users can toggle weekly emails on/off in settings
- Email summarizes last week: total units, top products, week-over-week change
- Email includes next week's forecast for top products
- Email uses the warm editorial design (cream bg, terra accents, serif headings)
- Cron runs weekly and only sends to opted-in businesses
- Email delivery uses existing Resend infrastructure

---

### Phase 22 Acceptance Criteria (Overall)
- Dashboard forecast hero matches the design with sparklines, trends, and action buttons
- Forecast detail shows full 14-day chart with prediction breakdown
- Products page shows per-product analytics
- Settings shows holiday region and weekly email toggle
- Weekly summary emails are delivered to opted-in users
- All existing functionality remains intact

---

## Phase 23: Demo Security & Rate Limiting
Branch: `fix/phase-23-demo-security`

### Goal
Protect the public demo deployment from API cost abuse and data destruction. Rate limit LLM-calling endpoints and safeguard the demo account.

### Dependencies
Phase 22 complete.

---

#### 23.1 Rate Limit LLM Endpoints

##### Tasks
- [x] 23.1.1 Add rate limiting to `POST /api/chat` — 20 messages per user per hour (reuse existing `rateLimit` utility)
- [x] 23.1.2 Add rate limiting to `POST /api/sales/parse` — 30 parses per user per hour
- [x] 23.1.3 Return a user-friendly error message when rate limited ("You've sent too many messages. Try again in a few minutes.")

##### Acceptance Criteria
- Chat endpoint rejects requests beyond 20/hour per user with 429 status
- Parse endpoint rejects requests beyond 30/hour per user with 429 status
- Existing 1-per-day insight generation guard remains unchanged
- Rate limit errors show a clear toast message in the UI

---

#### 23.2 Protect Demo Account

##### Tasks
- [x] 23.2.1 Add `isDemo` boolean field to User model (default: false), run Prisma migration
- [x] 23.2.2 Set `isDemo: true` on the demo user in `prisma/seed.ts`
- [x] 23.2.3 Block account deletion for demo users in `DELETE /api/account` — return "Demo account cannot be deleted"
- [x] 23.2.4 Block password change for demo users in `POST /api/auth/reset-password` — return "Demo account password cannot be changed"

##### Acceptance Criteria
- Demo account cannot be deleted via the settings page
- Demo account password cannot be reset
- Regular user accounts are unaffected
- Demo user sees a clear message explaining why the action is blocked

---

### Phase 23 Acceptance Criteria (Overall)
- LLM-calling endpoints are rate limited to prevent cost abuse
- Demo account is protected from deletion and password changes
- Normal user experience is unaffected by these guards

---

## Phase 24: Unit Testing Foundation
Branch: `feat/phase-24-testing`

### Goal
Add a test suite covering core business logic — the services that parse sales, match products, predict demand, normalize units, and handle dates. These are the highest-value tests: pure functions with no UI, easy to write, and they catch bugs that silently corrupt data.

### Dependencies
Phase 23 complete. No feature changes — testing only.

---

#### 24.1 Test Setup

##### Tasks
- [x] 24.1.1 Install Vitest as a dev dependency
- [x] 24.1.2 Create `vitest.config.ts` with TypeScript and path alias support
- [x] 24.1.3 Add `"test": "vitest --run"` script to `package.json`
- [x] 24.1.4 Verify setup with a trivial passing test

##### Acceptance Criteria
- `npm test` runs and exits cleanly
- TypeScript and `@/` path aliases work in test files

---

#### 24.2 Sales Parser & Unit Normalizer Tests

##### Tasks
- [x] 24.2.1 Create `src/services/__tests__/sales-parser.test.ts`
- [x] 24.2.2 Test basic NL parsing: "sold 20 eggs, 30kg beef" → correct products and quantities
- [x] 24.2.3 Test unit extraction: "5kg", "2 liters", "3 dozen" → correct quantity and unit
- [x] 24.2.4 Test edge cases: empty input, no quantities, duplicate products
- [x] 24.2.5 Create `src/lib/__tests__/unit-normalizer.test.ts`
- [x] 24.2.6 Test unit normalization: "Litre" → "liters", "Kg" → "kg", "L" → "liters", "pcs" → "pieces"

##### Acceptance Criteria
- Parser correctly extracts products, quantities, and units from NL text
- Unit normalizer maps all known variations to canonical forms
- Edge cases return empty results, not errors

---

#### 24.3 Product Matcher Tests

##### Tasks
- [x] 24.3.1 Create `src/services/__tests__/product-matcher.test.ts`
- [x] 24.3.2 Test exact matching: "Eggs" matches "Eggs"
- [x] 24.3.3 Test fuzzy matching: "egg" matches "Eggs", "minced beef" matches "Minced beef"
- [x] 24.3.4 Test no match: "halloumi" returns unmatched when not in product list
- [x] 24.3.5 Test plural handling: "chickens" matches "Chicken breast"

##### Acceptance Criteria
- Exact matches return the correct product ID
- Fuzzy matches work for common variations (case, plural, substring)
- Unmatched items are flagged correctly

---

#### 24.4 Prediction Engine Tests

##### Tasks
- [x] 24.4.1 Extract `mean`, `calculateConfidence`, and `calculatePrediction` as exported pure functions from prediction engine
- [x] 24.4.2 Create `src/services/__tests__/prediction-engine.test.ts`
- [x] 24.4.3 Test weighted prediction: 60% weekday + 40% recent
- [x] 24.4.4 Test confidence scaling with data volume (low/moderate/good/high tiers)
- [x] 24.4.5 Test confidence reduction with high variance data

##### Acceptance Criteria
- Predictions use 60% weekday / 40% recent weighting
- Confidence scales with data volume
- Holiday multipliers are applied correctly
- Insufficient data returns null, not bad predictions

---

#### 24.5 Date Utility Tests

##### Tasks
- [x] 24.5.1 Create `src/lib/__tests__/dates.test.ts`
- [x] 24.5.2 Test `getLocalDateStr` returns correct date for Melbourne timezone at midnight boundary
- [x] 24.5.3 Test `getTodayUTC` returns a Date object at UTC midnight for the local date
- [x] 24.5.4 Test `getDaysAgoUTC` returns the correct date N days back

##### Acceptance Criteria
- Date functions return correct results across timezone boundaries
- The midnight Melbourne edge case (the bug we just fixed) is covered

---

#### 24.6 Rate Limiter Tests

##### Tasks
- [x] 24.6.1 Create `src/lib/__tests__/rate-limit.test.ts`
- [x] 24.6.2 Test allows requests within limit
- [x] 24.6.3 Test blocks requests beyond limit
- [x] 24.6.4 Test window resets after expiry

##### Acceptance Criteria
- Rate limiter allows N requests within the window
- Request N+1 is rejected
- After the window expires, requests are allowed again

---

### Phase 24 Acceptance Criteria (Overall)
- `npm test` runs ~25-30 tests and passes
- Core business logic (parser, matcher, predictions, dates, rate limiter) is covered
- Tests run in < 5 seconds
- No database or network calls in tests (pure unit tests with mocks where needed)

---

## Phase 25: Sales Input UX Improvements
Branch: `feat/phase-25-sales-ux`

### Goal
Improve the sales input experience with business-type-aware placeholder text and editable product names in the confirmation screen.

### Dependencies
Phase 24 complete.

---

#### 25.1 Business-Type-Aware Placeholder Text

##### Tasks
- [x] 25.1.1 Create a placeholder text map keyed by `BusinessType` — each entry demonstrates NL parser capabilities (mixed units, commas, multiple items) with products relevant to that business type
- [x] 25.1.2 Add `type` to the business select in the sales page server component
- [x] 25.1.3 Pass `businessType` to `SalesInputClient` and use it to select the placeholder
- [x] 25.1.4 Fallback to a generic placeholder if business type is unknown

##### Acceptance Criteria
- Butcher sees "sold 12kg lamb chops, 8kg minced beef, 5 chickens"
- Café sees "sold 45 coffees, 12 sandwiches, 8 slices of cake"
- Grocer sees "sold 20 eggs, 2L milk, 5kg rice"
- Unknown/Other types see a generic placeholder
- Placeholder still demonstrates parser features (quantities, units, commas)

---

#### 25.2 Editable Product Names in Confirmation Screen

##### Tasks
- [x] 25.2.1 Make the product name in each parsed item row tappable — tapping opens an inline text input pre-filled with the current name
- [x] 25.2.2 On blur or enter, run a client-side match against the products list (case-insensitive exact match using the products already in React Query cache)
- [x] 25.2.3 If the new name matches an existing product → update `productId`, set `matched: true`, update unit to that product's default unit
- [x] 25.2.4 If the new name doesn't match any product → set `productId: null`, set `matched: false`, show "Add as new product" button with the user's typed name
- [x] 25.2.5 If the user clears the input and blurs → revert to the original parser name
- [x] 25.2.6 Update the checkmark/plus icon to reflect the current matched/unmatched state after edits

##### Acceptance Criteria
- User can tap a matched product name and change it to anything
- Changing to an existing product name re-links to that product
- Changing to an unknown name marks it as unmatched with "Add as new product"
- The "Add" button creates the product with the user's typed name, not the parser's original name
- Reverting (clearing input) restores the original parser match
- Quantity and unit are preserved when only the name changes
- Unit updates to the new product's default unit when re-matching to a different existing product

---

### Phase 25 Acceptance Criteria (Overall)
- NL input placeholder is relevant to the user's business type
- Users can correct product name matches in the confirmation screen
- Users can override a match to create a new product with their preferred name
- All existing confirmation screen functionality (quantity editing, ambiguous items, remove items) still works

---

## Phase 26: Production Foundations
Branch: `feat/phase-26-production-foundations`

### Goal
Establish production-grade practices — monitoring, security, documentation, and prompt management. Quick wins with high portfolio signal.

### Dependencies
Phase 25 complete.

---

#### 26.1 Health & Monitoring

##### Tasks
- [x] 26.1.1 Build `GET /api/health` endpoint — returns DB connectivity status, last insight generation time, uptime, app version
- [x] 26.1.2 Install Sentry SDK (`@sentry/nextjs`), configure in `next.config.ts` and root layout
- [x] 26.1.3 Add Sentry error boundary reporting to the app error boundary
- [x] 26.1.4 Add `SENTRY_DSN` to environment variables

##### Acceptance Criteria
- `/api/health` returns JSON with DB status, uptime, and last insight time
- Unhandled errors are reported to Sentry with context (user ID, business ID)
- Sentry dashboard shows errors from the deployed app

---

#### 26.2 Security & Documentation

##### Tasks
- [x] 26.2.1 Add input sanitization — strip HTML/script tags from `rawInput`, product names, and business name before storage
- [x] 26.2.2 Create `CHANGELOG.md` — initial changelog covering phases 1–25 in user-facing language
- [x] 26.2.3 Extract LLM prompts into `src/prompts/` directory — `chat.ts`, `insights.ts`, `parser.ts` with version comments

##### Acceptance Criteria
- `<script>` tags in NL input are stripped before storage
- CHANGELOG.md exists with a summary of shipped features
- Prompts are in separate versioned files, imported by the services that use them

---

## Phase 27: AWS Amplify Deployment
Branch: `feat/phase-27-amplify`

### Goal
Set up AWS Amplify as a secondary deployment. Foundation for all AWS service integrations — services connect via IAM roles instead of API keys.

### Dependencies
Phase 26 complete.

### Notes
No custom domain required. Works on Amplify's default `*.amplifyapp.com` domain.

---

#### 27.1 Amplify Setup

##### Tasks
- [x] 27.1.1 Create `amplify.yml` build config for Next.js 16 (App Router, SSR)
- [x] 27.1.2 Connect GitHub repo to AWS Amplify, deploy from `main` branch
- [x] 27.1.3 Configure environment variables in Amplify console (DATABASE_URL, AUTH_SECRET, AUTH_URL, ANTHROPIC_API_KEY)
- [x] 27.1.4 Verify full app works on Amplify URL — signup, onboarding, sales, dashboard, chat
- [x] 27.1.5 Set up IAM role for the Amplify app with permissions for S3, SES, Textract, SNS, CloudWatch

##### Acceptance Criteria
- App deploys and runs on Amplify's default domain
- All features work identically to the Vercel deployment
- IAM role is configured for future AWS service access

---

#### 27.2 Dockerize

##### Tasks
- [x] 27.2.1 Create `Dockerfile` with multi-stage build (deps → build → production)
- [x] 27.2.2 Create `.dockerignore` for node_modules, .git, docs
- [x] 27.2.3 Verify `docker build` and `docker run` work locally

##### Acceptance Criteria
- `docker build` produces a working image
- Container runs the app on port 3000
- Dockerfile is in the repo for portfolio reference (not used for deployment)

---

## Phase 28: AWS Email & Scheduling
Branch: `feat/phase-28-aws-email`

### Goal
Replace Resend with Amazon SES and Vercel Cron with EventBridge. These pair naturally since the weekly email uses both.

### Dependencies
Phase 27 complete (needs IAM role for SES and EventBridge access).

### Notes
SES works in sandbox mode without a custom domain — can only send to verified email addresses. Fine for portfolio demo.

---

#### 28.1 Amazon SES

##### Tasks
- [x] 28.1.1 Verify sender email in SES console (sandbox mode)
- [x] 28.1.2 Install `@aws-sdk/client-ses`
- [x] 28.1.3 Create `src/lib/ses.ts` — SES email sender with same interface as existing `sendEmail`
- [x] 28.1.4 Update `src/lib/email.ts` — try SES first, fall back to Resend if SES fails or isn't configured
- [x] 28.1.5 Test password reset and verification emails via SES

##### Acceptance Criteria
- Emails send via SES on the Amplify deployment
- Emails fall back to Resend on the Vercel deployment (no AWS credentials)
- Both providers use the same email templates

---

#### 28.2 Amazon EventBridge

##### Tasks
- [x] 28.2.1 Create EventBridge Scheduler rule — Monday 6 AM UTC → invokes weekly summary endpoint
- [x] 28.2.2 Configure the rule to call the Amplify deployment URL with CRON_SECRET header
- [ ] 28.2.3 Add CloudWatch alarm for failed EventBridge invocations

##### Acceptance Criteria
- Weekly summary email triggers via EventBridge on the Amplify deployment
- Vercel deployment continues using Vercel Cron as fallback
- Failed invocations trigger a CloudWatch alarm

---

## Phase 29: Receipt Upload & OCR
Branch: `feat/phase-29-receipt-ocr`

### Goal
Photo-to-sales-data pipeline using S3 and Textract. New feature with genuine product value — bridges the gap between paper receipts and digital sales logging.

### Dependencies
Phase 27 complete (needs IAM role for S3 and Textract access).

---

#### 29.1 S3 Upload

##### Tasks
- [x] 29.1.1 Create S3 bucket with lifecycle policy (auto-delete after 30 days)
- [x] 29.1.2 Build `POST /api/receipts/upload` — generates presigned S3 URL for client-side upload
- [x] 29.1.3 Build receipt upload UI on the sales input page — camera/file picker, upload progress bar
- [x] 29.1.4 Store receipt S3 key on the SalesEntry model (new optional `receiptKey` field)

##### Acceptance Criteria
- User can take a photo or select a file on the sales input page
- Photo uploads to S3 via presigned URL (no server-side file handling)
- Upload shows progress indicator

---

#### 29.2 Textract OCR

##### Tasks
- [x] 29.2.1 Install `@aws-sdk/client-textract`
- [x] 29.2.2 Build `POST /api/receipts/parse` — sends S3 object to Textract, extracts text
- [x] 29.2.3 Chain Textract output → existing NL parser → confirmation screen (same flow as typing)
- [x] 29.2.4 Show receipt source indicator in sales history ("📷 From receipt" badge)
- [x] 29.2.5 Handle Textract errors gracefully — show "couldn't read receipt, try typing instead"

##### Acceptance Criteria
- Uploaded receipt photo is processed by Textract
- Extracted text is fed into the existing NL parser pipeline
- User sees the same confirmation screen as NL input
- Failed OCR shows a helpful fallback message

---

## Phase 30: Observability & API Maturity
Branch: `feat/phase-30-observability`

### Goal
Backend improvements that show engineering depth — structured logging, consistent API responses, monitoring, and performance optimization.

### Dependencies
Phase 27 complete (needs IAM for CloudWatch).

---

#### 30.1 API Improvements

##### Tasks
- [ ] 30.1.1 Build request logging middleware — wrap all API routes with method, path, status code, duration
- [ ] 30.1.2 Migrate API responses to structured envelope format `{ data, error, meta }` across all routes
- [ ] 30.1.3 Database indexes audit — review Prisma schema query patterns, add missing indexes, create ADR documenting decisions

##### Acceptance Criteria
- Every API request is logged with method, path, status, and duration
- All API responses follow the same envelope format
- Missing indexes are added with documented rationale

---

#### 30.2 Monitoring

##### Tasks
- [ ] 30.2.1 Install `@aws-sdk/client-cloudwatch`
- [ ] 30.2.2 Push custom metrics to CloudWatch — API latency, LLM call count, error rate
- [ ] 30.2.3 Create CloudWatch alarms — error rate > 5%, LLM failure rate > 20%
- [ ] 30.2.4 Build LLM cost tracking — log token usage per request, add `GET /api/admin/llm-usage` summary

##### Acceptance Criteria
- CloudWatch dashboard shows API and LLM metrics
- Alarms fire when error thresholds are exceeded
- LLM usage endpoint shows total tokens and estimated cost

---

## Phase 31: Push Notifications
Branch: `feat/phase-31-notifications`

### Goal
Morning prep reminders via Amazon SNS. Completes the "wake up to your forecast" story from the PRD.

### Dependencies
Phase 28 complete (reuses EventBridge scheduling pattern).

### Notes
Web Push subscriptions are tied to the origin domain. If you later add a custom domain, subscriptions need to be re-created.

---

#### 31.1 Notification Infrastructure

##### Tasks
- [ ] 31.1.1 Set up Amazon SNS topic for push notifications
- [ ] 31.1.2 Add Web Push subscription flow — browser permission prompt, store subscription endpoint in DB
- [ ] 31.1.3 Add `pushSubscription` JSON field to User model, run Prisma migration
- [ ] 31.1.4 Build `POST /api/notifications/subscribe` — stores push subscription
- [ ] 31.1.5 Build `POST /api/notifications/morning-prep` — generates prep list from forecast, sends via SNS to Web Push

##### Acceptance Criteria
- User can enable push notifications from settings
- Subscription is stored in the database

---

#### 31.2 Scheduling & Preferences

##### Tasks
- [ ] 31.2.1 Add EventBridge rule — daily at 6 AM → triggers morning prep notification
- [ ] 31.2.2 Add notification preferences in settings (enable/disable, time preference)
- [ ] 31.2.3 Fallback: if push fails, send prep summary via email (SES)

##### Acceptance Criteria
- Opted-in users receive a morning prep notification with tomorrow's forecast
- Notification includes product quantities from the forecast
- Failed push falls back to email delivery

---

## Phase 32: Frontend Polish
Branch: `feat/phase-32-frontend-polish`

### Goal
UX improvements that show frontend engineering depth. Independent of AWS phases — can be done in parallel.

### Dependencies
Phase 25 complete (no AWS dependency).

---

#### 32.1 Performance & UX

##### Tasks
- [ ] 32.1.1 Add optimistic updates — sales save, settings toggles, product add/edit update UI immediately with rollback on error
- [ ] 32.1.2 Improve skeleton screens — match actual card layouts (forecast hero outline, week chart shape)
- [ ] 32.1.3 Add feature flags — `src/lib/feature-flags.ts` config to toggle LLM vs template, enable/disable chat

##### Acceptance Criteria
- Sales save feels instant (UI updates before server confirms)
- Skeleton screens match the shape of the actual content
- Feature flags can disable LLM features without code changes

---

#### 32.2 Accessibility & Offline

##### Tasks
- [ ] 32.2.1 Run Lighthouse accessibility audit, fix all issues scoring below 90
- [ ] 32.2.2 Document accessibility score in README
- [ ] 32.2.3 Add offline dashboard caching — service worker caches last dashboard response
- [ ] 32.2.4 Show "you're offline" banner when network is unavailable

##### Acceptance Criteria
- Lighthouse accessibility score ≥ 90
- Dashboard shows cached data when offline
- Offline banner appears and disappears correctly

---

## Phase 33: Advanced AWS & Infrastructure
Branch: `feat/phase-33-advanced-aws`

### Goal
Deeper AWS integrations for learning and portfolio depth. Lower priority but high signal.

### Dependencies
Phase 27 complete (needs IAM role).

---

#### 33.1 Security & AI

##### Tasks
- [x] 33.1.1 Migrate `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET` to AWS Secrets Manager via a hybrid env-first resolver in `src/lib/secrets.ts` (ADR-018). `DATABASE_URL` and `AUTH_SECRET` remain in `.env.production` per the ADR's documented framework carve-outs. Pulled forward and shipped out of phase order as the close-out for ADR-017's residual build-artifact risk.
- [ ] 33.1.2 Add Amazon Bedrock as alternative to direct Anthropic API — toggle via feature flag
- [ ] 33.1.3 Add Amazon Translate — auto-translate LLM-generated insights and chat responses for multilingual users

##### Acceptance Criteria
- `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, and `CRON_SECRET` resolve from AWS Secrets Manager at runtime via `getSecret()`; `DATABASE_URL` and `AUTH_SECRET` remain in `.env.production` per ADR-018's carve-outs
- Local development continues to work from `.env.local` with no AWS calls (hybrid resolver, env-first)
- Amplify SSR Lambda has least-privilege IAM (`secretsmanager:GetSecretValue` on three specific secret ARNs)
- Bedrock can be enabled via feature flag as an alternative AI provider
- Insights can be translated to a second language

##### Predecessor and follow-up
- **ADR-017** — removed `next.config.ts` `env`, routed all env vars through `amplify.yml` → `.env.production`, added `'server-only'` guards on lib modules. Closed the bundle-leak surface.
- **ADR-018** — adds the hybrid SM resolver and migrates three secrets. Closes 33.1.1.
- After cutover, the env-var entries for the three migrated secrets must be pruned from the Amplify Console and from `amplify.yml`'s server-only regex; until that step the env-first path remains the active source of truth (intentional zero-risk rollout).

---

#### 33.2 Backend Improvements

##### Tasks
- [ ] 33.2.1 Implement cursor-based pagination on sales history API (replace offset pagination)
- [ ] 33.2.2 Create ADR for database connection pooling — document Neon + PrismaPg adapter decision

##### Acceptance Criteria
- Sales history API supports cursor-based pagination
- Connection pooling decision is documented in an ADR

---

## Phase 34: NL Parser Evaluation Framework
Branch: `feat/phase-34-parser-eval`

### Goal
Quality assurance for the AI integration. A unique portfolio differentiator — shows you think about LLM reliability, not just integration.

### Dependencies
Phase 25 complete (no AWS dependency). Can run in parallel with AWS phases.

---

#### 34.1 Evaluation Suite

##### Tasks
- [ ] 34.1.1 Create `src/eval/golden-inputs.ts` — 20-30 test inputs with expected parsed outputs covering edge cases
- [ ] 34.1.2 Build evaluation runner — runs each input through both LLM and rule-based parsers, compares to expected output
- [ ] 34.1.3 Add `npm run eval` script that outputs accuracy metrics (match rate, unit accuracy, quantity accuracy)
- [ ] 34.1.4 Integrate into CI — run eval on PR, warn (not fail) if accuracy drops below 80%

##### Acceptance Criteria
- `npm run eval` runs 20-30 golden inputs and reports accuracy
- Both LLM and rule-based parsers are evaluated side by side
- CI reports accuracy metrics on every PR

---

## Phase 35: Voice Input (Amazon Transcribe — Option B)
Branch: `feat/phase-35-voice-transcribe`

### Goal
Let users log sales by speaking a short utterance. Audio is transcribed with **Amazon Transcribe using an async job + client polling** (Option B — avoids long-lived serverless requests). Transcript text is fed into the existing sales parse and confirmation flow.

### Dependencies
Phase 29 complete (S3 upload patterns, IAM, bucket). Requires Transcribe + S3 permissions on the deployment role.

### Notes
- **In scope:** batch/async transcription after the user stops recording.
- **Out of scope:** Transcribe Streaming (live partial words while speaking) — separate future work if desired.

---

#### 35.1 Audio capture & upload

##### Tasks
- [ ] 35.1.1 Add voice record control on sales NL tab — start/stop, max duration (e.g. 30s), clear error states
- [ ] 35.1.2 Upload audio to S3 — presigned PUT (reuse receipt bucket or dedicated `voice/` prefix + lifecycle)
- [ ] 35.1.3 Validate MIME type, size, and duration server-side where possible

##### Acceptance Criteria
- User can record, stop, and upload without blocking the UI unreasonably
- Oversized or too-long clips are rejected with a clear message

---

#### 35.2 Transcribe job (async)

##### Tasks
- [ ] 35.2.1 `POST /api/voice/transcribe` — accepts S3 key (or upload id), starts `StartTranscriptionJob`, returns `{ jobId }`
- [ ] 35.2.2 `GET /api/voice/transcribe/:jobId` — returns status (`IN_PROGRESS` | `COMPLETED` | `FAILED`) and transcript text when ready
- [ ] 35.2.3 Map Transcribe output (e.g. transcript file on S3) to plain text for the parser
- [ ] 35.2.4 On success, client calls existing `POST /api/sales/parse` with transcript, then opens confirmation sheet (same as typed NL)

##### Acceptance Criteria
- API returns `jobId` immediately (no single request blocked until Transcribe finishes)
- Polling works until completion or failure with user-visible states
- Parsed line items match quality expectations for spoken sales phrasing

---

#### 35.3 UX, fallback, and ops

##### Tasks
- [ ] 35.3.1 Rate limit voice endpoints (per business) to control cost
- [ ] 35.3.2 Graceful fallback when Transcribe unavailable — prompt user to type or use manual tab
- [ ] 35.3.3 Document env/IAM needs (Transcribe, S3 read/write on audio + transcript objects); align with Amplify `next.config.ts` env surfacing if needed
- [ ] 35.3.4 Update `docs/API.md`, `docs/TDD.md`, `CHANGELOG.md` when shipped

##### Acceptance Criteria
- Failed transcription does not strand the user — clear recovery path
- Docs and backlog stay aligned with shipped behavior

---

## Phase 36: Receipt OCR Hardening
Branch: `feat/phase-36-receipt-ocr-hardening`

### Goal
Close the gap exposed during Phase 29: when the LLM is unavailable, the receipt parse path falls through to the chat-style rule-based parser, which produces unusable output on Textract receipt text. Phase 36 stops the bad fallback in the short term and migrates Textract to a receipt-shaped API in the medium term so the input pipeline is structurally appropriate to the task.

### Reference
ADR-019 — Receipt OCR Hardening (LLM-only fallback policy + AnalyzeExpense migration).

### Dependencies
Phase 29 complete. No data model changes required for 36.1; 36.2 introduces an SDK client swap and a new internal mapping type but no Prisma migrations.

---

#### 36.1 LLM-only fallback policy (immediate)

##### Tasks
- [x] 36.1.1 Update `POST /api/receipts/parse` to short-circuit when `llmParseSalesInput` returns `null` — return `SERVICE_UNAVAILABLE` (503) with the new copy ("Receipt reading needs our AI service, which is temporarily unavailable. Please try again in a few minutes, or type your sale on the Log tab — that still works.")
- [x] 36.1.2 Verified: receipt upload UI's existing catch handler already surfaces `body.error.message` via `toast.error`, so the new 503 copy renders to the user without code changes
- [x] 36.1.3 Replace `lines.join(", ")` with `"\n"` in `extractReceiptTextFromS3` so receipt structure is preserved as semantic line breaks rather than collapsed into the parser's tokenizer boundary
- [x] 36.1.4 Add structured logging on receipt-route `parseMethod` (`llm | error`) so the rate at which the fallback is exercised is observable
- [x] 36.1.5 Audited confirmation-screen mass deletion — added a `×` remove button to unmatched parsed items so every row is recoverable in one tap regardless of match status (previously unmatched rows only had an "Add" button)
- [x] 36.1.6 Update `docs/API.md` — drop `parseMethod: "rule-based"` from `POST /api/receipts/parse` response shape, document the new 503 error contract
- [x] 36.1.7 Add a `## Unreleased` entry to `CHANGELOG.md` in user-facing language

##### Acceptance Criteria
- When the Anthropic API key is missing or Claude returns an error, `POST /api/receipts/parse` returns 503 with the new copy and no parsed items
- The confirmation screen no longer ever shows nonsense rows derived from receipt OCR text
- Textract line joining uses `"\n"`; commas in product descriptions are no longer treated as item separators
- Logs show whether each receipt parse went via LLM or hit the error path; ratio is observable in the logging backend
- The Log/NL tab's existing rule-based fallback behaviour is unchanged

---

#### 36.2 Migrate Textract to `AnalyzeExpense` (medium term)

##### Tasks
- [ ] 36.2.1 Replace `DetectDocumentTextCommand` with `AnalyzeExpenseCommand` in `src/lib/textract.ts`
- [ ] 36.2.2 Define an internal `ReceiptLineItem` type carrying `description`, `quantity`, `unit?`, `unitPrice?`, `total?` and map AWS `LineItemFields` onto it
- [ ] 36.2.3 Update `llmParseSalesInput` (or introduce a receipt-specific variant) to consume structured line items instead of raw text — prompt shrinks; the LLM only has to map descriptions to known products and resolve abbreviations
- [ ] 36.2.4 Build a receipt-specific rule-based path that bypasses `parseSalesInput` entirely: for each line item, call `matchProduct(description, products)` and use the AWS-provided quantity directly
- [ ] 36.2.5 Decide and implement the policy for the new structured fallback — keep LLM-only by default, expose behind a feature flag, or re-enable the structured fallback unconditionally; record the decision in a brief follow-up note in ADR-019 if it changes
- [ ] 36.2.6 Track `AnalyzeExpense` cost via the existing AWS billing tags / CloudWatch (Phase 30.2 surfaces this if landed; otherwise note for manual review)
- [ ] 36.2.7 Update `docs/TDD.md` — receipts go via `AnalyzeExpense`; the Log/NL tab pipeline is unchanged
- [ ] 36.2.8 Update `docs/API.md` — `POST /api/receipts/parse` response may include a `lineItems` array alongside `extractedText`
- [ ] 36.2.9 `## Unreleased` entry in `CHANGELOG.md`

##### Acceptance Criteria
- Receipt photos are parsed via `AnalyzeExpense` end-to-end; `DetectDocumentTextCommand` is no longer used on the receipt path
- The LLM path receives structured line items and the prompt is correspondingly simpler
- A structured-fallback path exists and works (tested with a stub LLM client returning null), even if it remains disabled by policy
- Per-receipt Textract cost is observable; spend delta is within expectations (~10× DetectDocumentText, still pennies per business per month at expected volumes)
- Existing tests pass; new tests cover the AWS line-item mapping and the structured-fallback matcher path

---

### Phase 36 Acceptance Criteria (Overall)
- LLM outage on the receipt path produces a clear, transient-sounding error rather than nonsense parsed items
- Textract is invoked via the receipt-shaped API; downstream parsing operates on structured line items rather than raw OCR text
- ADR-019 references the shipped behaviour; `docs/API.md` and `docs/TDD.md` reflect the new pipeline; `CHANGELOG.md` carries user-facing entries for both sub-phases

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
- [x] Normalize product default units on create and update — "Pieces", "pcs", "Kg" all stored as canonical form (`fix/normalize-product-units`)

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
