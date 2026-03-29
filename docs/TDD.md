# BizSense — Technical Design Document (TDD)

## 1. Document Overview

This document describes the technical architecture, data model, API contracts, component structure, and implementation details for BizSense MVP. It is informed by the [PRD](./PRD.md) and the [Architecture Decision Records](./adr/README.md).

### Referenced ADRs

| ADR | Decision |
|-----|----------|
| [001](adr/001-authentication-strategy.md) | Email/password + magic link via Auth.js |
| [002](adr/002-sales-input-dual-mode.md) | Dual-mode sales input (NL + manual form) |
| [003](adr/003-rule-based-nl-parser.md) | Rule-based NL parser for MVP |
| [004](adr/004-quantity-only-tracking.md) | Quantity-only tracking, no pricing |
| [005](adr/005-batch-processing-over-realtime.md) | Daily batch processing for insights |
| [006](adr/006-demand-prediction-approach.md) | Statistical demand prediction |
| [007](adr/007-tech-stack.md) | Next.js, Prisma, Neon, shadcn/ui |
| [008](adr/008-data-isolation-privacy.md) | Shared DB with application-level isolation |
| [009](adr/009-localization-architecture.md) | Localization-ready from day one |
| [010](adr/010-ai-chat-deferred.md) | AI chat deferred to future phase |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│                   Client (Browser)               │
│  Next.js App Router · React · Tailwind · shadcn  │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────┐
│              Next.js Server                      │
│  ┌──────────────┐  ┌─────────────────────────┐  │
│  │  App Router   │  │   API Routes (/api/*)   │  │
│  │  (SSR/RSC)    │  │   (REST endpoints)      │  │
│  └──────────────┘  └────────────┬────────────┘  │
│                                  │               │
│  ┌──────────────┐  ┌────────────▼────────────┐  │
│  │   Auth.js     │  │   Business Logic Layer  │  │
│  │  (Sessions)   │  │   (Services)            │  │
│  └──────┬───────┘  └────────────┬────────────┘  │
│         │                       │                │
│  ┌──────▼───────────────────────▼────────────┐  │
│  │          Prisma ORM (Data Access)          │  │
│  │     + Business Isolation Middleware         │  │
│  └──────────────────────┬────────────────────┘  │
└─────────────────────────┼────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────┐
│         PostgreSQL (Neon — Serverless)            │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│         OpenAI API (Insight Generation)           │
│         Called via batch job, not per-request      │
└──────────────────────────────────────────────────┘
```


### 2.2 Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group (no layout chrome)
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── verify/page.tsx       # Magic link verification
│   ├── (app)/                    # Authenticated app route group
│   │   ├── layout.tsx            # App shell (nav, mobile layout)
│   │   ├── dashboard/page.tsx
│   │   ├── sales/
│   │   │   ├── page.tsx          # Sales input (dual mode)
│   │   │   └── history/page.tsx  # Sales log
│   │   ├── products/page.tsx     # Product management
│   │   └── onboarding/page.tsx
│   ├── api/                      # API routes
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── business/route.ts
│   │   ├── products/route.ts
│   │   ├── sales/route.ts
│   │   ├── sales/[id]/route.ts
│   │   ├── dashboard/route.ts
│   │   ├── predictions/route.ts
│   │   └── insights/route.ts
│   ├── layout.tsx                # Root layout
│   ├── globals.css
│   └── favicon.ico
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── dashboard/                # Dashboard-specific components
│   ├── sales/                    # Sales input components
│   ├── onboarding/               # Onboarding flow components
│   └── shared/                   # Shared components (nav, loading, etc.)
├── lib/
│   ├── prisma.ts                 # Prisma client singleton
│   ├── auth.ts                   # Auth.js configuration
│   ├── api-helpers.ts            # API response helpers, error handling
│   └── constants.ts              # App-wide constants
├── services/
│   ├── sales-parser.ts           # Rule-based NL parser
│   ├── product-matcher.ts        # Fuzzy product matching
│   ├── prediction-engine.ts      # Demand prediction logic
│   ├── insight-generator.ts      # AI insight generation (batch)
│   └── analytics.ts              # Trend calculation utilities
├── hooks/                        # Custom React hooks
│   ├── use-sales.ts
│   ├── use-products.ts
│   ├── use-dashboard.ts
│   └── use-predictions.ts
├── types/                        # TypeScript type definitions
│   └── index.ts
├── messages/                     # i18n message files
│   └── en.json
└── middleware.ts                  # Auth middleware (route protection)
```

---

## 3. Data Model (Prisma Schema)

### 3.1 Complete Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Auth Models (managed by Auth.js) ───

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  passwordHash  String?
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts Account[]
  sessions Session[]
  business Business?
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─── Business Models ───

model Business {
  id        String       @id @default(cuid())
  name      String
  type      BusinessType
  locale    String       @default("en")
  onboarded Boolean      @default(false)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  products       Product[]
  salesEntries   SalesEntry[]
  dailyInsights  DailyInsight[]
  demandForecasts DemandForecast[]
}

enum BusinessType {
  RETAIL_VENDOR
  BUTCHER
  PRODUCE_SELLER
  MARKET_STALL
  GROCERY
  CAFE
  TAKEAWAY
  OTHER
}

model Product {
  id          String  @id @default(cuid())
  name        String
  defaultUnit String? // e.g., "kg", "liters", "pieces"
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())

  businessId String
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  salesItems      SalesItem[]
  demandForecasts DemandForecast[]

  @@unique([businessId, name])
}

model SalesEntry {
  id          String      @id @default(cuid())
  date        DateTime    @db.Date
  inputMethod InputMethod @default(MANUAL)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  businessId String
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  items SalesItem[]

  @@unique([businessId, date])
}

enum InputMethod {
  NATURAL_LANGUAGE
  MANUAL
}

model SalesItem {
  id       String  @id @default(cuid())
  quantity Float
  unit     String? // overrides product default if specified

  salesEntryId String
  salesEntry   SalesEntry @relation(fields: [salesEntryId], references: [id], onDelete: Cascade)

  productId String
  product   Product @relation(fields: [productId], references: [id])
}

model DailyInsight {
  id        String      @id @default(cuid())
  date      DateTime    @db.Date
  type      InsightType
  content   String      // Natural language insight text
  metadata  Json?       // Optional structured data backing the insight
  createdAt DateTime    @default(now())

  businessId String
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId, date])
}

enum InsightType {
  TREND
  COMPARISON
  TOP_PRODUCTS
  SUMMARY
}

model DemandForecast {
  id                String   @id @default(cuid())
  forecastDate      DateTime @db.Date
  predictedQuantity Float
  confidence        Float    // 0.0 to 1.0
  generatedAt       DateTime @default(now())

  businessId String
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  productId String
  product   Product @relation(fields: [productId], references: [id])

  @@unique([businessId, productId, forecastDate])
  @@index([businessId, forecastDate])
}
```


### 3.2 Data Isolation Strategy (ADR-008)

Every service function and API route receives the `businessId` from the authenticated session. Prisma queries always include `businessId` in the `where` clause.

```typescript
// Example: All product queries scoped to business
async function getProducts(businessId: string) {
  return prisma.product.findMany({
    where: { businessId, isActive: true },
    orderBy: { name: 'asc' },
  });
}
```

A Prisma middleware layer acts as a safety net, rejecting any query on business-scoped models that lacks a `businessId` filter.

---

## 4. Authentication (ADR-001)

### 4.1 Auth.js Configuration

- **Provider: Credentials** — email/password login
- **Provider: Email** — magic link (passwordless)
- **Session strategy:** JWT (stateless, no DB session lookups on every request)
- **Password hashing:** bcrypt
- **Adapter:** Prisma Adapter (stores users, accounts, sessions in PostgreSQL)

### 4.2 Auth Flow

```
Sign Up:
  POST /api/auth/signup → validate → hash password → create User + Business → redirect to onboarding

Login (password):
  POST /api/auth/callback/credentials → verify password → issue JWT session

Login (magic link):
  POST /api/auth/signin/email → send magic link email → user clicks → verify token → issue JWT session

Session:
  Every API request → middleware extracts JWT → resolves userId → resolves businessId
```

### 4.3 Route Protection

`src/middleware.ts` protects all `/(app)/*` routes. Unauthenticated users are redirected to `/login`. Auth routes (`/login`, `/signup`) redirect authenticated users to `/dashboard`.

---

## 5. API Contracts

All API routes follow these conventions:
- **Base path:** `/api/*`
- **Content type:** `application/json`
- **Auth:** All routes (except auth endpoints) require a valid session
- **Business scoping:** `businessId` extracted from session, never from request body
- **Error format:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": {}  // optional, field-level errors
  }
}
```

**Standard HTTP status codes:**
- `200` — Success
- `201` — Created
- `400` — Validation error
- `401` — Unauthorized
- `404` — Not found
- `409` — Conflict (duplicate)
- `500` — Internal server error

---

### 5.1 Business / Onboarding

#### `POST /api/business` — Complete Onboarding

Creates the business profile and initial products.

**Request:**
```json
{
  "name": "Ali's Butcher Shop",
  "type": "BUTCHER",
  "locale": "en",
  "products": [
    { "name": "Minced beef", "defaultUnit": "kg" },
    { "name": "Chicken breast", "defaultUnit": "kg" },
    { "name": "Lamb chops" }
  ]
}
```

**Response (201):**
```json
{
  "id": "clx...",
  "name": "Ali's Butcher Shop",
  "type": "BUTCHER",
  "locale": "en",
  "onboarded": true,
  "products": [
    { "id": "clx...", "name": "Minced beef", "defaultUnit": "kg" },
    { "id": "clx...", "name": "Chicken breast", "defaultUnit": "kg" },
    { "id": "clx...", "name": "Lamb chops", "defaultUnit": null }
  ]
}
```

**Validation (Zod):**
- `name`: string, 1–100 chars, required
- `type`: valid BusinessType enum value, required
- `locale`: string, 2–10 chars, default "en"
- `products`: array of 1–10 items, each with `name` (1–100 chars) and optional `defaultUnit`

**Errors:**
- `409` — Business already exists for this user

---

#### `GET /api/business` — Get Business Profile

**Response (200):**
```json
{
  "id": "clx...",
  "name": "Ali's Butcher Shop",
  "type": "BUTCHER",
  "locale": "en",
  "onboarded": true,
  "createdAt": "2026-03-29T10:00:00Z"
}
```

---

### 5.2 Products

#### `GET /api/products` — List Products

**Query params:** `?active=true` (default: true)

**Response (200):**
```json
{
  "products": [
    { "id": "clx...", "name": "Minced beef", "defaultUnit": "kg", "isActive": true },
    { "id": "clx...", "name": "Eggs", "defaultUnit": null, "isActive": true }
  ]
}
```

---

#### `POST /api/products` — Add Product

**Request:**
```json
{
  "name": "Milk bottles",
  "defaultUnit": "pieces"
}
```

**Response (201):**
```json
{
  "id": "clx...",
  "name": "Milk bottles",
  "defaultUnit": "pieces",
  "isActive": true
}
```

**Errors:**
- `409` — Product with this name already exists for this business

---

#### `PATCH /api/products` — Update Product

**Request:**
```json
{
  "id": "clx...",
  "name": "Whole milk bottles",
  "defaultUnit": "liters"
}
```

**Response (200):** Updated product object.

---

### 5.3 Sales

#### `POST /api/sales` — Log Sales Entry

Handles both input modes. If an entry for today already exists, it appends/merges items.

**Request:**
```json
{
  "date": "2026-03-29",
  "inputMethod": "NATURAL_LANGUAGE",
  "items": [
    { "productId": "clx...", "quantity": 20, "unit": null },
    { "productId": "clx...", "quantity": 30, "unit": "kg" }
  ]
}
```

**Response (201):**
```json
{
  "id": "clx...",
  "date": "2026-03-29",
  "inputMethod": "NATURAL_LANGUAGE",
  "items": [
    {
      "id": "clx...",
      "product": { "id": "clx...", "name": "Eggs" },
      "quantity": 20,
      "unit": null
    },
    {
      "id": "clx...",
      "product": { "id": "clx...", "name": "Minced beef" },
      "quantity": 30,
      "unit": "kg"
    }
  ]
}
```

**Validation:**
- `date`: valid ISO date string, not in the future, required
- `inputMethod`: valid InputMethod enum, required
- `items`: array of 1–50 items, each with `productId` (valid cuid), `quantity` (positive number), optional `unit`

---

#### `GET /api/sales` — List Sales Entries

**Query params:**
- `?from=2026-03-01&to=2026-03-29` — date range (default: last 30 days)
- `?limit=20&offset=0` — pagination

**Response (200):**
```json
{
  "entries": [
    {
      "id": "clx...",
      "date": "2026-03-29",
      "inputMethod": "MANUAL",
      "items": [
        { "id": "clx...", "product": { "id": "clx...", "name": "Eggs" }, "quantity": 20, "unit": null }
      ]
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

---

#### `GET /api/sales/[id]` — Get Single Sales Entry

**Response (200):** Single sales entry object (same shape as list item).

**Errors:**
- `404` — Entry not found or doesn't belong to this business

---

#### `PUT /api/sales/[id]` — Update Sales Entry

Replaces all items in the entry. Used for editing today's sales.

**Request:**
```json
{
  "items": [
    { "productId": "clx...", "quantity": 25, "unit": null },
    { "productId": "clx...", "quantity": 35, "unit": "kg" }
  ]
}
```

**Response (200):** Updated sales entry object.

**Constraints:**
- Can only edit entries from today (or within a configurable edit window)

---

#### `POST /api/sales/parse` — Parse Natural Language Input

Parses NL text into structured items without saving. Used for the confirmation screen.

**Request:**
```json
{
  "text": "sold 20 eggs, 30kg minced beef, and 10 milk bottles"
}
```

**Response (200):**
```json
{
  "parsed": [
    { "rawText": "20 eggs", "product": "Eggs", "productId": "clx...", "quantity": 20, "unit": null, "matched": true },
    { "rawText": "30kg minced beef", "product": "Minced beef", "productId": "clx...", "quantity": 30, "unit": "kg", "matched": true },
    { "rawText": "10 milk bottles", "product": "Milk bottles", "productId": null, "quantity": 10, "unit": null, "matched": false }
  ],
  "unmatched": ["Milk bottles"]
}
```

- `matched: true` — product found in existing catalog
- `matched: false` — new product detected, user should confirm addition
- `productId: null` — product not yet in catalog

---

### 5.4 Dashboard

#### `GET /api/dashboard` — Get Dashboard Data

Returns all dashboard sections in a single call (optimized for mobile — one request on app open).

**Response (200):**
```json
{
  "todaySummary": {
    "date": "2026-03-29",
    "totalItems": 5,
    "totalQuantity": 95,
    "items": [
      { "product": "Eggs", "quantity": 20 },
      { "product": "Minced beef", "quantity": 30, "unit": "kg" }
    ]
  },
  "weekSummary": {
    "totalQuantity": 450,
    "previousWeekQuantity": 380,
    "changePercent": 18.4,
    "dailyBreakdown": [
      { "date": "2026-03-23", "totalQuantity": 60 },
      { "date": "2026-03-24", "totalQuantity": 75 }
    ]
  },
  "topProducts": [
    { "product": "Eggs", "totalQuantity": 140, "rank": 1 },
    { "product": "Minced beef", "totalQuantity": 120, "rank": 2 }
  ],
  "insights": [
    { "type": "TREND", "content": "Egg sales increased 15% this week" },
    { "type": "COMPARISON", "content": "Milk sales dropped compared to last week" }
  ],
  "lastUpdated": "2026-03-29T02:00:00Z"
}
```

---

### 5.5 Predictions

#### `GET /api/predictions` — Get Demand Forecasts

**Query params:** `?horizon=day` or `?horizon=week`

**Response (200) — horizon=day:**
```json
{
  "forecastDate": "2026-03-30",
  "predictions": [
    { "product": "Eggs", "predictedQuantity": 25, "confidence": 0.82 },
    { "product": "Minced beef", "predictedQuantity": 32, "unit": "kg", "confidence": 0.75 }
  ],
  "dataPoints": 14,
  "generatedAt": "2026-03-29T02:00:00Z"
}
```

**Response (200) — horizon=week:**
```json
{
  "weekStart": "2026-03-30",
  "weekEnd": "2026-04-05",
  "predictions": [
    {
      "product": "Eggs",
      "daily": [
        { "date": "2026-03-30", "dayOfWeek": "Monday", "predictedQuantity": 22 },
        { "date": "2026-03-31", "dayOfWeek": "Tuesday", "predictedQuantity": 18 },
        { "date": "2026-04-04", "dayOfWeek": "Friday", "predictedQuantity": 30 }
      ]
    }
  ],
  "generatedAt": "2026-03-29T02:00:00Z"
}
```

**Errors:**
- `422` — Insufficient data (fewer than 5 sales entries)

---

### 5.6 Insights

#### `GET /api/insights` — Get AI-Generated Insights

**Query params:** `?date=2026-03-29` (default: today)

**Response (200):**
```json
{
  "date": "2026-03-29",
  "insights": [
    { "id": "clx...", "type": "TREND", "content": "Egg sales increased 15% this week" },
    { "id": "clx...", "type": "TOP_PRODUCTS", "content": "Your top 3 products account for 70% of total sales" },
    { "id": "clx...", "type": "SUMMARY", "content": "You logged 450 total units this week across 8 products" }
  ],
  "generatedAt": "2026-03-29T02:00:00Z"
}
```


---

## 6. Core Services (Business Logic)

### 6.1 Sales Parser (`services/sales-parser.ts`) — ADR-003

Rule-based parser that converts natural language input into structured sales items.

**Algorithm:**

```
Input: "sold 20 eggs, 30kg minced beef, and 10 milk bottles"

Step 1 — Normalize
  - Lowercase
  - Remove filler words: "sold", "I", "today", "about", "around"
  - Normalize whitespace

Step 2 — Tokenize
  - Split by commas and "and"
  - Result: ["20 eggs", "30kg minced beef", "10 milk bottles"]

Step 3 — Extract per token
  For each token:
    - Extract quantity: first number found (integer or decimal)
    - Extract unit: known units immediately adjacent to number (kg, g, liters, l, ml, pieces, pcs, dozen)
    - Remaining text = product name candidate
    - Trim and normalize product name

Step 4 — Match products
  For each extracted item:
    - Exact match against business product list (case-insensitive)
    - If no exact match → fuzzy match (Levenshtein distance ≤ 2, or substring match)
    - If no fuzzy match → flag as unmatched (new product candidate)

Step 5 — Return structured result
  - matched items with productId
  - unmatched items with productId: null
```

**Supported unit patterns:**
- Weight: kg, g, lbs, lb
- Volume: liters, l, ml, gallons
- Count: pieces, pcs, dozen, units
- No unit = default to product's `defaultUnit` or null

**Edge cases handled:**
- "a dozen eggs" → quantity: 12
- "half kg beef" → quantity: 0.5, unit: kg
- Duplicate products in same input → merge quantities
- Empty/unparseable tokens → skip with warning

---

### 6.2 Product Matcher (`services/product-matcher.ts`)

Fuzzy matching service used by the sales parser and product expansion feature.

**Matching strategy (in priority order):**
1. Exact match (case-insensitive): "eggs" → "Eggs"
2. Normalized match (strip plurals, trim): "egg" → "Eggs"
3. Substring match: "minced" → "Minced beef"
4. Levenshtein distance ≤ 2: "egs" → "Eggs"
5. No match → return as unmatched candidate

**Returns:** `{ productId, productName, confidence, matchType }` or `null`

---

### 6.3 Prediction Engine (`services/prediction-engine.ts`) — ADR-006

Generates next-day and next-week demand forecasts using statistical methods.

**Next-Day Prediction Algorithm:**

```
predict_next_day(product, targetDate):
  targetWeekday = dayOfWeek(targetDate)

  // Get same-weekday historical data (last 4 occurrences)
  sameWeekdaySales = getSalesForWeekday(product, targetWeekday, limit=4)

  // Get recent trend (last 7 days)
  recentSales = getRecentSales(product, days=7)

  weekdayAvg = mean(sameWeekdaySales)
  recentAvg = mean(recentSales)

  // Weighted blend: weekday pattern (60%) + recent trend (40%)
  prediction = 0.6 * weekdayAvg + 0.4 * recentAvg

  // Confidence based on data volume and variance
  confidence = calculateConfidence(sameWeekdaySales, recentSales)

  return { predictedQuantity: round(prediction), confidence }
```

**Confidence Calculation:**

| Data points | Base confidence |
|-------------|----------------|
| < 5 entries | 0.3 (low) |
| 5–14 entries | 0.5 (moderate) |
| 15–30 entries | 0.7 (good) |
| 30+ entries | 0.85 (high) |

Confidence is further adjusted by coefficient of variation (high variance → lower confidence).

**Weekly Prediction:**
- Run next-day algorithm for each day of the upcoming week
- Return array of 7 daily predictions per product

**Minimum data requirement:** 5 sales entries before predictions are generated. Below this threshold, the API returns a `422` with a message indicating more data is needed.

---

### 6.4 Insight Generator (`services/insight-generator.ts`) — ADR-005

Batch job that generates natural language insights daily.

**Insight types and generation logic:**

| Type | Logic | Example output |
|------|-------|----------------|
| TREND | Compare this week's product quantity vs. last week | "Egg sales increased 15% this week" |
| COMPARISON | Week-over-week total comparison | "Total sales up 18% compared to last week" |
| TOP_PRODUCTS | Rank products by quantity, calculate concentration | "Your top 3 products account for 70% of total sales" |
| SUMMARY | Aggregate stats for the period | "You logged 450 units across 8 products this week" |

**Generation approach (MVP):**
- Template-based string generation (not AI-generated in MVP)
- Templates with variable interpolation:
  ```
  "{product} sales {increased|decreased} {percent}% this week"
  "Your top {n} products account for {percent}% of total sales"
  "{weekday} is your {strongest|slowest} day"
  ```
- OpenAI API reserved for future enhancement (more natural phrasing, anomaly explanations)

**Batch execution:**
- Triggered daily via cron job or on-demand when dashboard data is stale (> 24 hours old)
- Processes all active businesses
- Stores results in `DailyInsight` table
- Old insights retained for historical reference

---

### 6.5 Analytics Service (`services/analytics.ts`)

Utility functions for trend calculation used by dashboard, insights, and predictions.

**Core functions:**

```typescript
// Get total quantity sold per product in a date range
getProductTotals(businessId, dateRange): ProductTotal[]

// Get daily quantity breakdown
getDailyBreakdown(businessId, dateRange): DailyBreakdown[]

// Compare two periods (e.g., this week vs last week)
comparePeriods(businessId, period1, period2): PeriodComparison

// Get top N products by quantity
getTopProducts(businessId, dateRange, limit): RankedProduct[]

// Get weekday averages for a product
getWeekdayAverages(businessId, productId): WeekdayAverage[]
```

---

## 7. Frontend Architecture

### 7.1 State Management

- **Server state:** React Query (TanStack Query) for all API data
- **Form state:** react-hook-form + zod for validation
- **No global client state store** — React Query cache is sufficient for MVP
- **Optimistic updates:** For sales logging (show saved state immediately, reconcile on response)

### 7.2 React Query Configuration

```typescript
// Query key conventions
const queryKeys = {
  business: ['business'] as const,
  products: ['products'] as const,
  sales: (filters: SalesFilters) => ['sales', filters] as const,
  salesEntry: (id: string) => ['sales', id] as const,
  dashboard: ['dashboard'] as const,
  predictions: (horizon: string) => ['predictions', horizon] as const,
  insights: (date: string) => ['insights', date] as const,
};

// Default options
{
  staleTime: 5 * 60 * 1000,      // 5 minutes (dashboard data is batch-generated)
  gcTime: 30 * 60 * 1000,        // 30 minutes
  retry: 2,
  refetchOnWindowFocus: true,     // Refresh when user returns to app
}
```

### 7.3 Key Component Tree

```
RootLayout
├── (auth) routes — no app shell
│   ├── LoginPage
│   │   └── LoginForm (email/password + magic link toggle)
│   ├── SignupPage
│   │   └── SignupForm
│   └── VerifyPage (magic link callback)
│
└── (app) routes — with app shell
    ├── AppLayout
    │   ├── MobileNav (bottom tab bar)
    │   └── children
    │
    ├── OnboardingPage
    │   └── OnboardingWizard
    │       ├── Step1_BusinessInfo (name, type)
    │       ├── Step2_Products (add 3-5 products)
    │       └── Step3_Locale (language preference)
    │
    ├── DashboardPage
    │   ├── TomorrowForecastCard
    │   ├── TodaySummaryCard
    │   ├── WeekTrendCard
    │   ├── TopProductsCard
    │   └── InsightsCard
    │
    ├── SalesInputPage
    │   ├── InputModeToggle (NL / Manual)
    │   ├── NaturalLanguageInput
    │   │   ├── TextArea
    │   │   └── ParseButton
    │   ├── ManualFormInput
    │   │   ├── ProductList (with quantity steppers)
    │   │   └── AddProductInline
    │   └── ConfirmationSheet
    │       ├── ParsedItemsList (editable)
    │       ├── UnmatchedProductPrompt
    │       └── SaveButton
    │
    ├── SalesHistoryPage
    │   └── SalesEntryList (scrollable, grouped by date)
    │
    └── ProductsPage
        └── ProductList (with edit/deactivate)
```

### 7.4 Mobile Navigation

Bottom tab bar with 3 primary tabs:

| Tab | Icon | Route |
|-----|------|-------|
| Dashboard | Home | `/dashboard` |
| Log Sales | Plus/Add | `/sales` |
| History | List | `/sales/history` |

Products page accessible from dashboard settings or a secondary menu.

---

## 8. Localization Architecture (ADR-009)

### 8.1 Setup

- Library: `next-intl` (integrates with Next.js App Router)
- Default locale: `en`
- Message files: `src/messages/{locale}.json`
- Locale stored in `Business.locale` field
- Locale resolved from: business preference → browser default → `en`

### 8.2 Message File Structure

```json
// src/messages/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "loading": "Loading...",
    "error": "Something went wrong"
  },
  "auth": {
    "login": "Log in",
    "signup": "Sign up",
    "email": "Email address",
    "password": "Password",
    "magicLink": "Send magic link",
    "forgotPassword": "Forgot password?"
  },
  "onboarding": {
    "welcome": "Welcome to BizSense",
    "businessName": "What's your business name?",
    "businessType": "What type of business?",
    "addProducts": "Add your main products (3-5)",
    "finish": "Get started"
  },
  "dashboard": {
    "tomorrowForecast": "Tomorrow's Forecast",
    "todaySummary": "Today's Sales",
    "thisWeek": "This Week",
    "topProducts": "Top Products",
    "insights": "Insights",
    "lastUpdated": "Updated {time}",
    "noData": "Log your first sales to see insights here"
  },
  "sales": {
    "inputPlaceholder": "e.g., sold 20 eggs, 30kg beef...",
    "parse": "Parse",
    "manualMode": "Enter manually",
    "nlMode": "Type it out",
    "confirmTitle": "Confirm your sales",
    "newProduct": "New product detected",
    "addProduct": "Add to my products",
    "saved": "Sales saved"
  },
  "predictions": {
    "title": "Demand Forecast",
    "needMoreData": "Log at least 5 days of sales to see predictions",
    "confidence": {
      "low": "Low confidence",
      "moderate": "Moderate confidence",
      "good": "Good confidence",
      "high": "High confidence"
    }
  }
}
```

### 8.3 Formatting

- Dates: `Intl.DateTimeFormat` with business locale
- Numbers: `Intl.NumberFormat` with business locale
- Relative time: "2 hours ago", "yesterday" via `Intl.RelativeTimeFormat`

---

## 9. Batch Processing Pipeline (ADR-005)

### 9.1 Trigger Strategy

For MVP, batch processing is triggered on-demand rather than via a scheduled cron:

1. User opens dashboard
2. Frontend calls `GET /api/dashboard`
3. API checks `lastUpdated` timestamp of latest insights
4. If stale (> 24 hours or no insights exist):
   - Synchronously generate insights for this business
   - Store in `DailyInsight` and `DemandForecast` tables
   - Return fresh data
5. If fresh: return cached data from DB

**Why on-demand for MVP:**
- No cron infrastructure needed
- Only active businesses incur compute cost
- Latency acceptable (< 2s for insight generation on small datasets)
- Can migrate to scheduled cron when user base grows

### 9.2 Batch Job Steps

```
1. Fetch all sales data for the business (last 30 days)
2. Calculate analytics:
   - Daily totals
   - Weekly totals and comparison
   - Product rankings
   - Weekday patterns
3. Generate insights (template-based):
   - Trend insights per product
   - Week-over-week comparison
   - Top products summary
   - Weekday pattern insights
4. Generate demand forecasts:
   - Next-day prediction per active product
   - Next-week prediction per active product
5. Store results:
   - Upsert DailyInsight records
   - Upsert DemandForecast records
6. Return aggregated dashboard response
```

---

## 10. Security Considerations

### 10.1 Authentication & Authorization
- Passwords hashed with bcrypt (cost factor 12)
- JWT sessions with short expiry (7 days) + refresh
- CSRF protection via Auth.js built-in mechanisms
- Rate limiting on auth endpoints (login, signup, magic link)

### 10.2 Input Validation
- All API inputs validated with Zod schemas
- SQL injection prevented by Prisma parameterized queries
- XSS prevented by React's default escaping + no `dangerouslySetInnerHTML`

### 10.3 Data Access
- Every DB query scoped to `businessId` from session (ADR-008)
- Prisma middleware as safety net for missing business scope
- No direct database access from client — all through API routes

### 10.4 API Security
- All API routes require valid session (enforced by middleware)
- Request body size limits (1MB max)
- No sensitive data in URL parameters

---

## 11. Error Handling Strategy

### 11.1 API Layer
- Zod validation errors → `400` with field-level details
- Auth errors → `401` with redirect to login
- Not found → `404` with resource type
- Business logic errors → `422` with descriptive message
- Unexpected errors → `500` with generic message (details logged server-side)

### 11.2 Frontend Layer
- React Query error boundaries for data fetching failures
- Toast notifications (sonner) for user-facing errors
- Retry logic built into React Query (2 retries with exponential backoff)
- Offline detection with "no connection" banner
- Form validation errors shown inline (react-hook-form + zod)

---

## 12. Performance Considerations

### 12.1 Database
- Indexes on frequently queried columns (see Prisma schema `@@index` directives)
- `@@unique` constraints double as indexes for common lookups
- Neon connection pooling to handle serverless cold starts

### 12.2 Frontend
- React Server Components for initial page loads (less client JS)
- React Query caching reduces redundant API calls
- Single dashboard API call (aggregated response) instead of multiple requests
- Image optimization via Next.js `<Image>` component
- Code splitting via Next.js App Router (per-route bundles)

### 12.3 API
- Dashboard response is pre-computed (reads from DB, no computation on request when fresh)
- Sales parse endpoint is CPU-only (no external API calls)
- Insight generation bounded by data volume (small businesses = small datasets)

---

## 13. Testing Strategy

### 13.1 Unit Tests
- Sales parser: comprehensive test suite covering all input patterns and edge cases
- Product matcher: fuzzy matching accuracy tests
- Prediction engine: known-input/known-output tests with historical data fixtures
- Insight generator: template output verification

### 13.2 Integration Tests
- API routes: request/response contract tests with test database
- Auth flows: signup, login, magic link, session management
- Data isolation: verify business A cannot access business B's data

### 13.3 E2E Tests
- Onboarding flow: signup → onboarding → dashboard
- Sales logging: NL input → parse → confirm → save → verify in history
- Dashboard: verify all sections render with seed data

---

## 14. Deployment

### 14.1 Infrastructure
- **Hosting:** Vercel (natural fit for Next.js)
- **Database:** Neon PostgreSQL (serverless, auto-scaling)
- **Environment variables:**
  - `DATABASE_URL` — Neon connection string
  - `NEXTAUTH_SECRET` — Auth.js session encryption key
  - `NEXTAUTH_URL` — Application URL
  - `OPENAI_API_KEY` — For future AI insight enhancement

### 14.2 CI/CD
- GitHub Actions (or Vercel Git integration)
- On PR: lint + type check + unit tests
- On merge to main: deploy to production
- Database migrations via `prisma migrate deploy`

---

## 15. ADR Cross-Reference Summary

| Concern | Decision | ADR |
|---------|----------|-----|
| Auth | Email/password + magic link via Auth.js | 001 |
| Sales input | Dual mode (NL + manual form) | 002 |
| NL parsing | Rule-based for MVP | 003 |
| Data tracking | Quantity only, no pricing | 004 |
| Insight timing | Daily batch, not real-time | 005 |
| Predictions | Statistical (moving avg + weekday patterns) | 006 |
| Tech stack | Next.js, Prisma, Neon, shadcn/ui | 007 |
| Data privacy | Shared DB, app-level business isolation | 008 |
| Localization | Architecture-ready from day one, English only | 009 |
| AI chat | Deferred to future phase | 010 |
