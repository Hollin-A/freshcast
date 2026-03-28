# BizSense — Product Requirements Document (PRD)

## 1. Overview

### Product Summary

BizSense is a mobile-first AI assistant for small retail businesses that helps owners quickly log daily sales and receive actionable insights, trends, and demand predictions — without requiring complex inventory or POS systems.

### Problem Statement

Small business owners (market vendors, butchers, cafés, grocery stores) face a common set of challenges:

- They don't use advanced business tools because they're too complex
- They lack visibility into sales trends and performance
- They rely on intuition rather than data for stocking decisions
- They waste stock or miss sales opportunities due to poor demand estimation

Existing solutions (POS/ERP systems) are too complex, require heavy setup, and aren't tailored for small operators.

### Solution

BizSense provides:

- Ultra-simple sales input (natural language + manual form)
- Quantity-focused demand prediction (core differentiator)
- Lightweight trend analysis and business insights
- Proactive daily forecasts on the dashboard

All without requiring full inventory, catalog setup, or ERP integration.

---

## 2. Goals & Success Metrics

### Goals

1. Reduce friction in daily sales tracking to near-zero
2. Provide meaningful quantity-based insights within 7 days of usage
3. Help users make better stocking decisions through demand prediction
4. Create a product users return to daily

### Success Metrics (MVP)

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

## 4. Non-Goals (MVP Boundaries)

BizSense will NOT:

- Replace POS systems
- Manage inventory lifecycle
- Handle suppliers or purchase orders
- Require full product catalog setup
- Provide cross-business comparisons or competitor insights
- Track pricing or revenue (quantity-only in MVP)
- Include an AI chat/conversational interface (deferred to future phase)

---

## 5. Product Principles

1. **Low friction over completeness** — speed of input matters more than capturing every detail
2. **Insight over data entry** — the value is in what users learn, not what they type
3. **Mobile-first experience** — designed for one-handed use during a busy day
4. **Private, business-specific intelligence** — each business's data is isolated
5. **AI as assistant, not replacement** — augments decisions, doesn't make them
6. **Choice in interaction** — users pick the input method that suits them

---

## 6. Core Features (MVP)

### 6.1 Authentication

**Description:** Simple account creation and login, one account per business.

**Approach:** Email/password authentication with optional magic link (passwordless) for convenience.

**Requirements:**
- Sign up with email and password
- Login with email/password or magic link
- Password reset flow
- Session persistence (stay logged in on device)
- One account = one business (no multi-user support in MVP)

**Constraints:**
- No social login in MVP
- No phone/OTP in MVP
- No multi-user or role-based access in MVP

---

### 6.2 Onboarding

**Description:** Minimal onboarding to get users started quickly.

**Requirements:**
- User provides:
  - Business name
  - Business type (select from predefined list + "Other")
  - 3–5 core products (free text input)
- System creates initial product list from onboarding input
- Locale/language preference selection

**Constraints:**
- Must complete in < 2 minutes
- No full catalog required
- Skip option for non-essential fields

---

### 6.3 Sales Input — Dual Mode (Core Feature)

**Description:** Users log daily sales through their preferred method.

#### Mode A: Natural Language Input

A large text input field where users type sales in plain language.

**Example inputs:**
- "Sold 20 eggs, 30kg minced beef, and 10 milk bottles"
- "12 chickens, 5kg lamb"

**Functional Requirements:**
- Large, prominent text input field
- Rule-based parser (MVP) to extract structured data
- Match input against existing product list
- Detect new/unknown products and prompt user to confirm addition
- Confirmation screen before saving (editable parsed results)

**Parsed Output Format:**
```json
[
  { "product": "Eggs", "quantity": 20 },
  { "product": "Minced beef", "quantity": 30, "unit": "kg" },
  { "product": "Milk bottles", "quantity": 10 }
]
```

#### Mode B: Manual Form Input

A structured form listing the user's existing products.

**Functional Requirements:**
- List all products from the user's product catalog
- Quantity input field per product (number stepper or direct input)
- Optional unit selector per product
- "Add new product" option inline
- Confirm and save

**UX Notes:**
- Both modes accessible from the same screen (tab or toggle)
- Natural language input is the default/promoted mode
- Manual form is the fallback for users who prefer structured input

---

### 6.4 AI-Assisted Product Expansion

**Description:** The system grows the product list dynamically as users log sales.

**Behavior:**
- Match input against known products (fuzzy matching)
- Detect unknown items from natural language input
- Prompt user to confirm new products before adding
- Suggest unit type for new products based on product category

---

### 6.5 Sales Logging & Storage

**Description:** Structured storage of daily sales data.

**Data Captured:**
- Date
- Product
- Quantity
- Unit (optional, e.g., kg, liters, pieces)
- Input method used (NL or manual)

**Requirements:**
- One sales entry per day (or append to existing day's entry)
- Ability to edit today's sales entry
- View historical sales log (list view, scrollable)

---

### 6.6 Dashboard (Home Screen)

**Description:** The primary screen users see after login, showing business insights at a glance.

**MVP Content:**

| Section | Content |
|---|---|
| Tomorrow's Forecast | Predicted quantities for top products (proactive, always visible) |
| Today's Summary | Products sold today with quantities |
| This Week | Trend overview, comparison with previous week |
| Top Products | Most sold items (by quantity) |
| AI Insights | Auto-generated natural language summaries |

**Requirements:**
- Insights generated via daily batch processing (not real-time)
- Dashboard refreshes when user opens the app (pulls latest batch)
- Clean, card-based layout
- Mobile-optimized single-column design

---

### 6.7 Demand Prediction

**Description:** Suggest expected demand for upcoming periods to help stocking decisions.

**Time Horizons:**

1. **Next Day Forecast** — "You may need ~25 eggs tomorrow"
   - Most actionable; vendors prep stock the night before
   - Shown proactively on dashboard

2. **Next Week Overview** — "Fridays are your strongest beef days"
   - Planning view for bulk purchasing
   - Weekday-level breakdown

**Approach (MVP):**
- Trend-based logic using historical sales data
- Simple moving averages
- Weekday pattern detection (e.g., Fridays vs. Mondays)
- No heavy ML required — rule-based statistical methods

**Minimum Data Required:**
- Predictions begin after 5–7 days of sales entries
- Accuracy improves with more data; communicate this to users

---

### 6.8 AI Insights (Auto-Generated)

**Description:** Automatically generated business insights shown on the dashboard.

**Example Insights:**
- "Egg sales increased 15% this week"
- "Milk sales dropped compared to last week"
- "Your top 3 products account for 70% of total quantity sold"
- "Wednesday is your slowest day"

**Requirements:**
- Generated via daily batch processing
- Based solely on user's own data
- Natural language format, easy to scan
- Refreshed daily

---

## 7. Privacy & Trust Model

### Core Principle

Each business's data is private and completely isolated.

### Rules

- No data sharing between businesses
- No benchmarking or aggregation in MVP
- No competitor insights
- AI insights and predictions based only on the user's own data
- Clear privacy messaging in the app

### User-Facing Message

> "Your data is private. BizSense works only for your business."

---

## 8. Localization

### MVP Approach

- English as the default language
- Architecture designed with localization in mind from day one
- All user-facing strings externalized (not hardcoded)
- Date, number, and unit formatting respects locale
- RTL layout support considered in component design

### Future Phases

- Additional language packs based on target market research
- Locale-specific unit defaults (e.g., kg vs. lbs)
- Localized AI insight generation

---

## 9. Platform & UX

### Platform

Mobile-first responsive web application.

### UX Requirements

- Single-column layout
- Large, touch-friendly inputs and buttons
- Minimal typing required
- Fast interactions (< 200ms perceived response)
- Clean, uncluttered interface
- Card-based dashboard design
- Clear visual hierarchy

### Design Tokens

- Consistent spacing, typography, and color system
- Accessible color contrast (WCAG AA minimum)
- Support for system dark/light mode preference

---

## 10. Technical Architecture

### Frontend
- Next.js (App Router)
- Tailwind CSS
- shadcn/ui
- React Query

### Backend
- Next.js API routes

### Database
- PostgreSQL (Neon)
- Prisma ORM

### AI Layer
- OpenAI API (or equivalent) — used for insight generation and future NL parsing upgrade

### Localization
- next-intl or equivalent i18n library
- Externalized string resources

---

## 11. Data Model (Simplified)

```
Business
├── id
├── name
├── type
├── locale
├── createdAt

Product
├── id
├── name
├── defaultUnit
├── businessId → Business

SalesEntry
├── id
├── businessId → Business
├── date

SalesItem
├── id
├── salesEntryId → SalesEntry
├── productId → Product
├── quantity
├── unit

DailyInsight
├── id
├── businessId → Business
├── date
├── type (trend | prediction | summary)
├── content (natural language text)

DemandForecast
├── id
├── businessId → Business
├── productId → Product
├── forecastDate
├── predictedQuantity
├── confidence
├── generatedAt
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

## 13. MVP Scope & Timeline

### Week 1 — Foundation
- Authentication (email/password + magic link)
- Onboarding flow
- Product model and management
- Sales input (both modes)
- Rule-based NL parser
- Data storage

### Week 2 — Intelligence
- Dashboard with daily summary
- Sales analytics and trend calculation
- Demand prediction engine (next day + weekly)
- AI insight generation (batch)

### Week 3 — Polish
- Product suggestion/expansion logic
- UI refinement and mobile optimization
- Localization architecture setup
- Empty states and onboarding guidance

### Week 4 — Launch Prep
- Seed/demo data for presentation
- Error handling and edge cases
- Performance optimization
- Deployment
- Documentation

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

## 15. Future Phases (Post-MVP)

### Phase 2 — Enhanced Input
- AI-powered natural language parsing (upgrade from rule-based)
- Voice input for hands-free logging
- Receipt/photo parsing via OCR

### Phase 3 — Conversational AI
- AI Chat interface for business questions
  - "What sold best this week?"
  - "When should I prepare more chicken?"
  - "How did eggs perform this month?"
- Pre-built query suggestions + free-form input
- Responses based solely on user's own data

### Phase 4 — Advanced Intelligence
- Advanced forecasting models (ML-based)
- Seasonal pattern detection
- Event/holiday impact analysis
- Anomaly detection (unusual sales spikes/drops)

### Phase 5 — Platform Expansion
- PWA support with offline capability
- Native mobile apps (iOS/Android)
- Multi-user support per business (owner + employees)
- Role-based access control

### Phase 6 — Ecosystem
- POS system integrations
- Supplier/purchase order management
- Multi-branch business support
- Aggregated anonymous insights (opt-in benchmarking)

### Authentication Upgrades (Future)
- Social login (Google, Apple)
- Phone number / OTP authentication
- Multi-factor authentication

### Pricing & Revenue Tracking (Future)
- Optional price per product
- Revenue metrics and dashboards
- Profit margin tracking (if cost data added)

---

## 16. Final Product Statement

> **BizSense** is a lightweight AI assistant that helps small retail businesses turn daily sales quantities into meaningful insights and smarter stocking decisions — without the complexity of traditional systems. Its core differentiator is quantity-based demand prediction that tells vendors exactly what to prepare for tomorrow.
