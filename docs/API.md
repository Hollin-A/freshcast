# Freshcast API Documentation

All API routes are prefixed with `/api`. Authenticated routes require a valid JWT session (via NextAuth.js). Error responses follow a standard shape:

```json
{ "error": { "code": "ERROR_CODE", "message": "Human-readable message", "details": {} } }
```

---

## Table of Contents

- [Authentication](#authentication)
- [Account](#account)
- [Business](#business)
- [Products](#products)
- [Sales](#sales)
- [Receipts (S3 + OCR)](#receipts-s3--ocr)
- [Analytics & Insights](#analytics--insights)
- [AI Chat](#ai-chat)
- [Email (Cron)](#email-cron)
- [Demo Data](#demo-data)
- [Health](#health)
- [Data Models](#data-models)
- [Security Notes](#security-notes)

---

## Authentication

### `POST /api/auth/signup`

Creates a new user account and sends a verification email.

**Auth required:** No  
**Rate limit:** 10 requests per IP per hour

**Request body:**
```json
{
  "name": "string (1–100 chars)",
  "email": "valid email",
  "password": "string (min 8 chars)"
}
```

**Response `201`:**
```json
{ "message": "Account created successfully" }
```

**Error codes:** `RATE_LIMITED` (429), `VALIDATION_ERROR` (400), `CONFLICT` (409 — email already in use), `INTERNAL_ERROR` (500)

---

### `GET /api/auth/verify-email`

Verifies a user's email address using a token sent in the welcome email.

**Auth required:** No

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `token` | string | Verification token |
| `email` | string | User's email address |

**Response:** Redirects to `/settings?verified=true`

**Error codes:** `VALIDATION_ERROR` (400 — invalid or expired token), `INTERNAL_ERROR` (500)

---

### `POST /api/auth/send-verification`

Resends the email verification link to the authenticated user.

**Auth required:** Yes

**Request body:** None

**Response `200`:**
```json
{ "message": "Verification email sent" }
```

**Error codes:** `UNAUTHORIZED` (401), `INTERNAL_ERROR` (500)

---

### `POST /api/auth/forgot-password`

Sends a password reset link. Always returns success to prevent email enumeration.

**Auth required:** No  
**Rate limit:** 3 requests per email per hour

**Request body:**
```json
{ "email": "valid email" }
```

**Response `200`:**
```json
{ "message": "If an account exists, a reset link has been sent." }
```

**Error codes:** `VALIDATION_ERROR` (400), `INTERNAL_ERROR` (500)

---

### `POST /api/auth/reset-password`

Resets the user's password using a valid reset token (1-hour expiry).

**Auth required:** No

**Request body:**
```json
{
  "email": "valid email",
  "token": "reset token",
  "password": "string (min 8 chars)"
}
```

**Response `200`:**
```json
{ "message": "Password reset successfully. You can now log in." }
```

**Error codes:** `VALIDATION_ERROR` (400 — invalid/expired token), `INTERNAL_ERROR` (500)

---

### `GET /POST /api/auth/[...nextauth]`

NextAuth.js catch-all handler. Manages sign-in, sign-out, and session callbacks.

- **Strategy:** JWT
- **Provider:** Credentials (email + bcrypt password)
- **Session shape:** `{ user: { id, email, name } }`

---

## Account

### `DELETE /api/account`

Permanently deletes the authenticated user's account and all associated data (businesses, products, sales, insights, forecasts, sessions).

**Auth required:** Yes

**Response `200`:**
```json
{ "message": "Account deleted successfully" }
```

**Error codes:** `UNAUTHORIZED` (401), `INTERNAL_ERROR` (500)

---

## Business

### `POST /api/business`

Creates a business profile for the authenticated user. Each user can only have one business.

**Auth required:** Yes

**Request body:**
```json
{
  "name": "string (1–100 chars)",
  "type": "RETAIL_VENDOR | BUTCHER | PRODUCE_SELLER | MARKET_STALL | GROCERY | CAFE | TAKEAWAY | OTHER",
  "locale": "string (2–10 chars, default: 'en')",
  "timezone": "IANA timezone string (default: 'UTC')",
  "products": [
    {
      "name": "string (1–100 chars)",
      "defaultUnit": "string (max 20 chars, optional)"
    }
  ]
}
```

**Constraints:**
- At least 1 product, maximum 10 products
- `timezone` must be a valid IANA timezone string
- Only one business per user

**Response `201`:** Created Business object with nested products

**Error codes:** `UNAUTHORIZED` (401), `CONFLICT` (409 — business already exists), `VALIDATION_ERROR` (400), `INTERNAL_ERROR` (500)

---

### `GET /api/business`

Returns the authenticated user's business profile.

**Auth required:** Yes

**Response `200`:**
```json
{
  "id": "string",
  "name": "string",
  "type": "string",
  "locale": "string",
  "onboarded": true,
  "createdAt": "ISO timestamp"
}
```

Note: `timezone`, `region`, and `weeklyEmailEnabled` are persisted on the model but currently not returned by `GET /api/business` (they are read directly from the session-scoped business in the routes that need them). If these become part of the public API contract, this section should be updated alongside the route.

**Error codes:** `UNAUTHORIZED` (401), `NOT_FOUND` (404), `INTERNAL_ERROR` (500)

---

### `PATCH /api/business`

Updates mutable fields on the authenticated user's business. Currently only `weeklyEmailEnabled` is exposed; future toggles (e.g. region, timezone) will be added here.

**Auth required:** Yes

**Request body:**
```json
{
  "weeklyEmailEnabled": true
}
```

All fields are optional; the body is treated as a partial update.

**Response `200`:**
```json
{
  "id": "string",
  "weeklyEmailEnabled": true
}
```

**Error codes:** `UNAUTHORIZED` (401), `NOT_FOUND` (404 — no business for this user), `VALIDATION_ERROR` (400), `INTERNAL_ERROR` (500)

---

## Products

### `GET /api/products`

Returns the business's product catalogue.

**Auth required:** Yes

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `active` | boolean | `true` | Filter to active products only |

**Response `200`:**
```json
{
  "products": [
    { "id": "string", "name": "string", "defaultUnit": "string", "isActive": true }
  ]
}
```

**Error codes:** `UNAUTHORIZED` (401), `INTERNAL_ERROR` (500)

---

### `POST /api/products`

Adds a new product to the business catalogue.

**Auth required:** Yes

**Request body:**
```json
{
  "name": "string (1–100 chars)",
  "defaultUnit": "string (max 20 chars, optional)"
}
```

**Response `201`:** Created product object

**Error codes:** `UNAUTHORIZED` (401), `CONFLICT` (409 — name already used), `VALIDATION_ERROR` (400), `INTERNAL_ERROR` (500)

---

### `PATCH /api/products`

Updates an existing product.

**Auth required:** Yes

**Request body:**
```json
{
  "id": "product ID",
  "name": "string (1–100 chars, optional)",
  "defaultUnit": "string (max 20 chars, optional)",
  "isActive": "boolean (optional)"
}
```

**Response `200`:** Updated product object

**Error codes:** `UNAUTHORIZED` (401), `NOT_FOUND` (404), `CONFLICT` (409 — duplicate name), `VALIDATION_ERROR` (400), `INTERNAL_ERROR` (500)

---

## Sales

### `POST /api/sales`

Records a new sales entry for the business.

**Auth required:** Yes

**Request body:**
```json
{
  "date": "YYYY-MM-DD (must not be in the future)",
  "inputMethod": "NATURAL_LANGUAGE | MANUAL",
  "rawInput": "string (max 1000 chars, optional — used for NL entries)",
  "receiptKey": "string (optional S3 key for receipt-origin entries)",
  "items": [
    {
      "productId": "string",
      "quantity": "number (positive)",
      "unit": "string (optional)"
    }
  ]
}
```

**Constraints:** 1–50 items per entry; all `productId` values must belong to the authenticated business.

**Response `201`:** Created SalesEntry with nested items and product details

**Error codes:** `UNAUTHORIZED` (401), `VALIDATION_ERROR` (400), `INTERNAL_ERROR` (500)

---

### `GET /api/sales`

Returns a paginated list of sales entries.

**Auth required:** Yes

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | `20` | Max 100 |
| `offset` | number | `0` | Pagination offset |
| `from` | ISO date | 30 days ago | Start of date range |
| `to` | ISO date | today | End of date range |

**Response `200`:**
```json
{
  "entries": [...],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

Results ordered by date DESC, then createdAt DESC.

**Error codes:** `UNAUTHORIZED` (401), `INTERNAL_ERROR` (500)

---

### `GET /api/sales/[id]`

Returns a single sales entry.

**Auth required:** Yes

**Response `200`:** Full SalesEntry with nested items and product details

**Error codes:** `UNAUTHORIZED` (401), `NOT_FOUND` (404), `INTERNAL_ERROR` (500)

---

### `PUT /api/sales/[id]`

Replaces the items in a sales entry. Only today's entry (in business timezone) can be edited.

**Auth required:** Yes

**Request body:**
```json
{
  "items": [
    {
      "productId": "string",
      "quantity": "number (positive)",
      "unit": "string (optional)"
    }
  ]
}
```

**Response `200`:** Updated SalesEntry with new items

**Error codes:** `UNAUTHORIZED` (401), `NOT_FOUND` (404), `VALIDATION_ERROR` (400 — not today's entry), `INTERNAL_ERROR` (500)

---

### `DELETE /api/sales/[id]`

Deletes a sales entry.

**Auth required:** Yes

**Response `200`:**
```json
{ "message": "Entry deleted" }
```

**Error codes:** `UNAUTHORIZED` (401), `NOT_FOUND` (404), `INTERNAL_ERROR` (500)

---

### `GET /api/sales/export`

Exports sales data as a CSV file.

**Auth required:** Yes

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | ISO date | 30 days ago | Start of export range |
| `to` | ISO date | today | End of export range |

**Response:** CSV file download  
**Headers:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="freshcast-sales-YYYY-MM-DD-to-YYYY-MM-DD.csv"`  
**CSV columns:** Date, Time, Product, Quantity, Unit, Input Method

**Error codes:** `UNAUTHORIZED` (401), `INTERNAL_ERROR` (500)

---

### `POST /api/sales/parse`

Parses a natural-language sales description into structured line items using Claude (falls back to rule-based parsing).

**Auth required:** Yes

**Request body:**
```json
{ "text": "string (1–1000 chars)" }
```

**Response `200`:**
```json
{
  "parsed": [
    {
      "productId": "string",
      "quantity": 12,
      "unit": "kg",
      "confidence": 0.95
    }
  ],
  "parseMethod": "llm | rule-based",
  "warnings": ["string"]
}
```

**Error codes:** `UNAUTHORIZED` (401), `VALIDATION_ERROR` (400), `INTERNAL_ERROR` (500)

---

## Receipts (S3 + OCR)

### `POST /api/receipts/upload`

Generates a presigned S3 upload URL for receipt images.

**Auth required:** Yes

**Request body:**
```json
{
  "fileName": "receipt.jpg",
  "contentType": "image/jpeg"
}
```

**Response `200`:**
```json
{
  "key": "receipts/<businessId>/<timestamp>-<uuid>-receipt.jpg",
  "uploadUrl": "https://...",
  "previewUrl": "https://...",
  "expiresInSeconds": 300
}
```

**Notes:**
- Allowed content types: JPEG, PNG, WEBP
- `key` is business-scoped and later passed to parse and save APIs
- Requires `S3_RECEIPTS_BUCKET` and valid AWS credentials/role

**Error codes:** `UNAUTHORIZED` (401), `VALIDATION_ERROR` (400), `SERVICE_UNAVAILABLE` (503), `INTERNAL_ERROR` (500)

---

### `POST /api/receipts/parse`

Runs OCR on an uploaded receipt image using **Amazon Textract `AnalyzeExpense`** (the receipt/invoice-shaped API), then maps the structured line items through the LLM receipt parser. Receipts are LLM-only by default per ADR-019; the structured rule-based fallback can be opted into via `RECEIPT_FALLBACK=structured`. When neither path produces a result, the route returns 503 rather than emitting low-quality parsed items.

**Auth required:** Yes

**Request body:**
```json
{
  "key": "receipts/<businessId>/<...>.jpg"
}
```

**Response `200`:**
```json
{
  "parsed": [...],
  "unmatched": [...],
  "parseMethod": "llm | rule-based-structured",
  "source": "receipt",
  "key": "receipts/<businessId>/<...>.jpg",
  "extractedText": "...",
  "lineItems": [
    {
      "description": "FREE RANGE EGGS 12PK",
      "quantity": 1,
      "unit": null,
      "unitPrice": 9.50,
      "total": 9.50,
      "rawRow": "FREE RANGE EGGS 12PK    $9.50"
    }
  ]
}
```

`lineItems` is the AWS-structured intermediate representation, returned alongside `parsed` for transparency and to support future reconciliation flows. `parseMethod` is always `"llm"` unless the operator has explicitly enabled the structured fallback.

**Response `503` — LLM unavailable (structured fallback disabled):**
```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Receipt reading needs our AI service, which is temporarily unavailable. Please try again in a few minutes, or type your sale on the Log tab — that still works."
  }
}
```

**Response `503` — no readable line items detected:**
```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "No readable line items were detected in the receipt image."
  }
}
```

**Error codes:** `UNAUTHORIZED` (401), `FORBIDDEN` (403), `VALIDATION_ERROR` (400), `SERVICE_UNAVAILABLE` (503 — Textract failure, no detected line items, or LLM unavailable with the structured fallback disabled), `INTERNAL_ERROR` (500)

**Environment variable naming note:**
- Preferred: `APP_AWS_REGION`, `APP_AWS_ACCESS_KEY_ID`, `APP_AWS_SECRET_ACCESS_KEY`
- Backward-compatible fallback: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `RECEIPT_FALLBACK=structured` (optional) — opt into the structured rule-based fallback when the LLM is unavailable. Off by default per ADR-019; pending the broader feature-flag system in Phase 32.1.3.

---

## Analytics & Insights

### `GET /api/dashboard`

Returns all data needed to render the main dashboard in a single request.

**Auth required:** Yes

**Response `200`:**
```json
{
  "hasAnySales": true,
  "totalEntries": 42,
  "todaySummary": { ... },
  "weekSummary": { ... },
  "topProducts": [ { "productId": "...", "name": "...", "totalQuantity": 120 } ],
  "forecast": {
    "predictions": [...],
    "dataPoints": 14,
    "holiday": null
  },
  "weeklyForecast": { ... },
  "insights": [...],
  "lastUpdated": "ISO timestamp"
}
```

Data is aggregated in parallel from sales, forecast, and insight services.

**Error codes:** `UNAUTHORIZED` (401), `INTERNAL_ERROR` (500)

---

### `GET /api/insights`

Returns or generates AI-powered daily insights for the business (TREND, COMPARISON, TOP_PRODUCTS, SUMMARY types).

**Auth required:** Yes

**Response `200`:**
```json
{
  "date": "YYYY-MM-DD",
  "insights": [...],
  "generatedAt": "ISO timestamp"
}
```

**Error codes:** `UNAUTHORIZED` (401), `INTERNAL_ERROR` (500)

---

### `GET /api/predictions`

Returns demand forecasts for the next day or week.

**Auth required:** Yes  
**Minimum data required:** 5 days of sales history

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `horizon` | `"day" \| "week"` | `"day"` | Forecast horizon |

**Response `200` (horizon=day):**
```json
{
  "forecastDate": "YYYY-MM-DD",
  "predictions": [
    { "productId": "string", "predictedQuantity": 15, "confidence": 0.82 }
  ],
  "dataPoints": 14,
  "generatedAt": "ISO timestamp"
}
```

**Response `200` (horizon=week):**
```json
{
  "weekStart": "YYYY-MM-DD",
  "weekEnd": "YYYY-MM-DD",
  "predictions": [...],
  "generatedAt": "ISO timestamp"
}
```

**Error codes:** `UNAUTHORIZED` (401), `INSUFFICIENT_DATA` (422 — fewer than 5 days of data), `VALIDATION_ERROR` (400 — invalid horizon), `INTERNAL_ERROR` (500)

---

## AI Chat

### `POST /api/chat`

Sends a message to the Freshcast AI assistant. The assistant answers questions about the business's own sales data.

**Auth required:** Yes

**Request body:**
```json
{
  "message": "string (1–500 chars)",
  "history": [
    { "role": "user | assistant", "content": "string" }
  ]
}
```

Up to 10 prior messages may be included in `history`.

**Response `200`:**
```json
{ "response": "AI-generated text response" }
```

**Behaviour:** Powered by Claude. The system prompt restricts the model to answering only from provided sales context, keeps answers concise (2–3 sentences), uses specific numbers, and frames predictions as guidance rather than certainty. Max response: 512 tokens.

**Error codes:** `UNAUTHORIZED` (401), `VALIDATION_ERROR` (400), `SERVICE_UNAVAILABLE` (503 — Claude API unavailable), `INTERNAL_ERROR` (500)

---

## Email (Cron)

### `POST /api/email/weekly-summary`

Triggers weekly summary emails for every business with `weeklyEmailEnabled: true`. Designed to be invoked on a schedule by Amazon EventBridge (production) or Vercel Cron (mirror), but can also be invoked manually with the cron secret.

**Auth required:** No session — instead, a shared secret is required when one is configured.

**Authorization:**
- If a `CRON_SECRET` is resolvable (env first, then AWS Secrets Manager `freshcast/cron-secret`), the request must include `Authorization: Bearer <CRON_SECRET>`. Requests without a matching bearer token are rejected with 401.
- If no `CRON_SECRET` is configured (e.g. local dev), the route accepts the request without auth.

**Request body:** None

**Response `200`:**
```json
{
  "sent": 4,
  "failed": 0,
  "total": 4
}
```

`sent` and `failed` partition the businesses that were processed; `total` is the number of businesses with `weeklyEmailEnabled: true`. Per-business send results are logged via the structured logger but not returned in the response.

**Error codes:** `UNAUTHORIZED` (401 — invalid bearer token), `INTERNAL_ERROR` (500)

---

## Demo Data

### `POST /api/demo`

Populates the account with 14 days of realistic sample sales data. Only available on empty accounts.

**Auth required:** Yes

**Request body:** None

**Response `201`:**
```json
{ "message": "Demo data loaded. Your dashboard is ready." }
```

**Sample data includes:** Eggs, Minced beef, Chicken breast, Milk, Bread — with day-of-week multipliers and random variation.

**Error codes:** `UNAUTHORIZED` (401), `CONFLICT` (409 — sales data already exists), `INTERNAL_ERROR` (500)

---

## Health

### `GET /api/health`

Lightweight liveness/readiness probe. Suitable for uptime monitors, load-balancer health checks, and post-deploy smoke tests.

**Auth required:** No

**Response `200`:**
```json
{
  "status": "healthy",
  "uptime": 3421,
  "database": "ok",
  "lastInsightGeneration": "2026-05-06T19:14:02.000Z",
  "version": "0.1.0",
  "timestamp": "2026-05-07T08:42:11.123Z"
}
```

Field semantics:
- `status` — `"healthy"` if the database probe succeeds, `"degraded"` if it fails. The route always returns 200; the body indicates degradation.
- `uptime` — seconds since the SSR Lambda warmed up (resets per cold start).
- `database` — `"ok"` or `"error"`. Determined by a `SELECT 1` against the Prisma client.
- `lastInsightGeneration` — `createdAt` of the most recent `DailyInsight` row across all businesses, or `null` if none exist.
- `version` — `npm_package_version` if available, otherwise `"0.1.0"`.

**Error codes:** none — this route never returns a non-200 status.

---

## Data Models

### User
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | CUID |
| `email` | string | Unique |
| `emailVerified` | datetime? | Null until verified via `GET /api/auth/verify-email` |
| `passwordHash` | string? | bcrypt, 12 rounds. Nullable to support OAuth providers in future. |
| `name` | string? | |
| `image` | string? | Reserved for future avatar support |
| `isDemo` | boolean | `true` for the seeded demo account; demo accounts are undeletable and password-immutable (see Phase 23) |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

### Business
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | CUID |
| `name` | string | |
| `type` | enum | See business types below |
| `locale` | string | e.g. `"en"`, default `"en"` |
| `timezone` | string | IANA timezone, default `"UTC"`, validated server-side via `Intl.DateTimeFormat` |
| `region` | string | Default `"AU-VIC"`. Drives holiday-aware predictions (`src/data/holidays.ts`). |
| `weeklyEmailEnabled` | boolean | Default `false`. Toggled via `PATCH /api/business`. Drives `POST /api/email/weekly-summary` recipient list. |
| `onboarded` | boolean | Default `false`; set to `true` when onboarding completes |
| `userId` | string | Unique FK → User (one business per user) |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

**Business types:** `RETAIL_VENDOR`, `BUTCHER`, `PRODUCE_SELLER`, `MARKET_STALL`, `GROCERY`, `CAFE`, `TAKEAWAY`, `OTHER`

### Product
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | CUID |
| `name` | string | Unique per business |
| `defaultUnit` | string? | e.g. `"kg"`, `"units"` |
| `isActive` | boolean | |
| `businessId` | string | FK → Business |

### SalesEntry
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | CUID |
| `date` | date | Local business date (`@db.Date`, no time component) |
| `inputMethod` | enum | `NATURAL_LANGUAGE \| MANUAL` |
| `rawInput` | string? | Original NL text (or Textract `rawText` for receipt-origin entries) — kept for audit |
| `receiptKey` | string? | S3 object key when entry originated from a receipt upload |
| `businessId` | string | FK → Business |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

Note: there is intentionally **no** unique constraint on `(businessId, date)` — businesses log multiple entries per day (morning + afternoon, etc.) per ADR-014.

### SalesItem
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | CUID |
| `quantity` | float | Positive |
| `unit` | string? | |
| `salesEntryId` | string | FK → SalesEntry |
| `productId` | string | FK → Product |

### DailyInsight
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | CUID |
| `date` | date | |
| `type` | enum | `TREND \| COMPARISON \| TOP_PRODUCTS \| SUMMARY` |
| `content` | string | Insight text shown on the dashboard |
| `metadata` | JSON? | Supporting data (e.g. percentage change, product references) |
| `generationMethod` | string | `"template"` or `"llm"` — tracks whether the LLM or the template fallback produced the row. Default `"template"`. |
| `businessId` | string | FK → Business |
| `createdAt` | datetime | |

Indexed on `(businessId, date)`; uniquely constrained on `(businessId, date, type)` to prevent duplicate inserts on concurrent requests.

### DemandForecast
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | CUID |
| `forecastDate` | date | |
| `predictedQuantity` | float | |
| `confidence` | float | 0–1 |
| `generatedAt` | datetime | |
| `businessId` | string | FK → Business |
| `productId` | string | FK → Product |

Indexed on `(businessId, forecastDate)`; uniquely constrained on `(businessId, productId, forecastDate)`.

---

## Security Notes

| Concern | Implementation |
|---------|----------------|
| Authentication | JWT via NextAuth.js; all protected routes call `auth()` |
| Password storage | bcrypt (12 salt rounds) |
| Data isolation | Every route resolves `businessId` from the session and verifies ownership |
| Email verification | Tokens expire after 24 hours; deleted on use |
| Password reset | Tokens expire after 1 hour; all reset tokens cleared atomically on use |
| Rate limiting | In-memory sliding window — signup (10/hr/IP), password reset (3/hr/email) |
| Email enumeration | `forgot-password` always returns the same success message |
| Cascade deletes | Business deletion cascades to all child records via Prisma schema |
