# Freshcast — Improvement Backlog

A prioritized list of improvements to make Freshcast a more robust full-stack portfolio project. Items marked ✅ have been promoted to the implementation plan and completed. Remaining items are candidates for future phases.

Priority: P0 (do first) → P1 (high value) → P2 (nice to have)

---

## Production Quality

| # | Item | Priority | Status | Phase |
|---|------|----------|--------|-------|
| 1 | Sentry error monitoring integration | P0 | ✅ Done | 26 |
| 2 | Health endpoint (`GET /api/health`) | P0 | ✅ Done | 26 |
| 3 | Structured API response envelope — consistent `{ data, error, meta }` format | P1 | 🔲 Planned | 30 |
| 4 | Request logging middleware — method, path, status, duration | P1 | 🔲 Planned | 30 |
| 5 | Database connection pooling ADR | P2 | 🔲 Planned | 33 |

## Frontend

| # | Item | Priority | Status | Phase |
|---|------|----------|--------|-------|
| 6 | Optimistic updates on sales save and settings toggles | P0 | 🔲 Planned | 32 |
| 7 | Skeleton screens that match actual card layouts | P1 | 🔲 Planned | 32 |
| 8 | Accessibility audit — Lighthouse/axe | P1 | 🔲 Planned | 32 |
| 9 | Offline support — cache dashboard, "you're offline" banner | P2 | 🔲 Planned | 32 |

## Backend

| # | Item | Priority | Status | Phase |
|---|------|----------|--------|-------|
| 10 | Input sanitization on text fields (XSS protection) | P0 | ✅ Done | 26 |
| 11 | Database indexes audit | P1 | 🔲 Planned | 30 |
| 12 | Cursor-based pagination on sales history | P2 | 🔲 Planned | 33 |
| 13 | API versioning — `/api/v1/` prefix | P2 | 🔲 Planned | — |

## AI/ML Integration

| # | Item | Priority | Status | Phase |
|---|------|----------|--------|-------|
| 14 | Prompt versioning — separate versioned files | P0 | ✅ Done | 26 |
| 15 | LLM cost tracking — log token usage, expose summary | P1 | 🔲 Planned | 30 |
| 16 | Evaluation framework — golden test inputs for NL parser | P1 | 🔲 Planned | 34 |

## Shipping & Documentation

| # | Item | Priority | Status | Phase |
|---|------|----------|--------|-------|
| 17 | CHANGELOG.md | P0 | ✅ Done | 26 |
| 18 | Feature flags — toggle LLM vs template, enable/disable chat | P1 | 🔲 Planned | 32 |

---

## AWS Service Integrations

| # | Service | Purpose | Status | Phase |
|---|---------|---------|--------|-------|
| 19 | Amazon SES | Email delivery (replaces Resend) | ✅ Done | 28 |
| 20 | Amazon EventBridge | Scheduled jobs (replaces Vercel Cron) | ✅ Done | 28 |
| 21 | Amazon Bedrock | Enterprise AI access (replaces direct Anthropic) | 🔲 Planned | 33 |
| 22 | Amazon RDS/Aurora | Enterprise database (replaces Neon) | 🔲 Planned | — |
| 23 | Amazon Cognito | MFA + social login (replaces Auth.js) | 🔲 Planned | — |
| 24 | S3 + CloudFront | Receipt photo upload & storage | 🔲 Planned | 29 |
| 25 | Amazon Textract | OCR receipt parsing | 🔲 Planned | 29 |
| 26 | Amazon SNS | Morning prep push notifications | 🔲 Planned | 31 |
| 27 | Amazon Translate | Auto-translate insights & chat | 🔲 Planned | 33 |
| 28 | Amazon DynamoDB | Persistent chat history | 🔲 Planned | — |
| 29 | AWS CloudWatch | Monitoring, metrics, alerting | 🔲 Planned | 30 |
| 30 | AWS Secrets Manager | API key management | 🔲 Planned | 33 |
| 31 | AWS Lambda | Background processing | 🔲 Planned | — |

## AWS Deployment

| # | Item | Status | Phase |
|---|------|--------|-------|
| 32 | AWS Amplify deployment | ✅ Done | 27 |
| 33 | Dockerize the app | ✅ Done | 27 |

---

## Progress Summary

- ✅ Completed: 9 of 33 items (1, 2, 10, 14, 17, 19, 20, 32, 33)
- 🔲 Planned (in implementation plan): 18 items
- — Unplanned: 6 items (13, 22, 23, 28, 31 — low priority, no phase assigned)
