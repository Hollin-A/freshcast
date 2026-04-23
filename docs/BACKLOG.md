# Freshcast — Improvement Backlog

A prioritized list of improvements to make Freshcast a more robust full-stack portfolio project. Items here get promoted into implementation plan phases when ready to build.

Priority: P0 (do first) → P1 (high value) → P2 (nice to have)

---

## Production Quality

| # | Item | Priority | Effort | Signal |
|---|------|----------|--------|--------|
| 1 | Sentry error monitoring integration | P0 | 30 min | Shows production mindset — you care about what happens after deploy |
| 2 | Health endpoint (`GET /api/health`) — uptime, DB connectivity, last insight generation | P0 | 15 min | Shows operational awareness |
| 3 | Structured API response envelope — consistent `{ data, error, meta }` format | P1 | 2 hrs | Shows API design maturity |
| 4 | Request logging middleware — method, path, status, duration on every API call | P1 | 1 hr | Shows observability awareness |
| 5 | Database connection pooling ADR — document why Neon + PrismaPg adapter | P2 | 15 min | Shows infrastructure understanding |

## Frontend

| # | Item | Priority | Effort | Signal |
|---|------|----------|--------|--------|
| 6 | Optimistic updates on sales save and settings toggles | P0 | 1 hr | Shows React Query depth and perceived performance awareness |
| 7 | Skeleton screens that match actual card layouts | P1 | 1 hr | Shows UX attention to detail |
| 8 | Accessibility audit — run Lighthouse/axe, fix issues, document score | P1 | 2 hrs | Most portfolio projects ignore this entirely |
| 9 | Offline support — cache dashboard data, show "you're offline" banner | P2 | 3 hrs | Impressive PWA depth |

## Backend

| # | Item | Priority | Effort | Signal |
|---|------|----------|--------|--------|
| 10 | Input sanitization on text fields (XSS protection on rawInput, product names) | P0 | 30 min | Shows security awareness |
| 11 | Database indexes audit — review Prisma schema, add missing indexes, document decisions | P1 | 1 hr | Shows database performance awareness |
| 12 | Cursor-based pagination on sales history (replace offset pagination) | P2 | 2 hrs | Shows you know the tradeoffs |
| 13 | API versioning — `/api/v1/` prefix with documentation on why | P2 | 1 hr | Shows API evolution thinking |

## AI/ML Integration

| # | Item | Priority | Effort | Signal |
|---|------|----------|--------|--------|
| 14 | Prompt versioning — store prompts in separate versioned files | P0 | 30 min | Shows you treat prompts as code |
| 15 | LLM cost tracking — log token usage, expose simple summary | P1 | 1 hr | Shows cost awareness with external APIs |
| 16 | Evaluation framework — golden test inputs with expected outputs for the NL parser | P1 | 2 hrs | Shows LLM quality assurance thinking |

## Shipping & Documentation

| # | Item | Priority | Effort | Signal |
|---|------|----------|--------|--------|
| 17 | CHANGELOG.md — user-facing changelog tracking what shipped | P0 | 20 min | Shows shipping discipline |
| 18 | Feature flags — simple config to toggle LLM vs template, enable/disable chat | P1 | 1 hr | Shows gradual rollout thinking |

---

## Priority Summary

### P0 — Do first (highest impact, lowest effort)
1. Sentry error monitoring
2. Health endpoint
6. Optimistic updates
10. Input sanitization
14. Prompt versioning
17. CHANGELOG.md

### P1 — High value
3. Structured API response envelope
4. Request logging middleware
7. Skeleton screen improvements
8. Accessibility audit
11. Database indexes audit
15. LLM cost tracking
16. NL parser evaluation framework
18. Feature flags

### P2 — Nice to have
5. Connection pooling ADR
9. Offline support
12. Cursor-based pagination
13. API versioning

---

## AWS Service Integrations

Services that add genuine product value while building AWS experience. Cost estimates assume low-volume portfolio/demo usage (not production scale).

### Direct Swaps (replace existing third-party services)

| # | Service | Replaces | Priority | Effort | Cost (monthly) | Product Reason |
|---|---------|----------|----------|--------|----------------|----------------|
| 19 | Amazon SES | Resend | P0 | 1 hr | Free tier: 3,000 emails/mo. Then ~$0.10/1,000 | Removes vendor dependency on email delivery. Lower cost at scale. |
| 20 | Amazon EventBridge Scheduler | Vercel Cron | P1 | 1 hr | Free tier: 14M invocations/mo. Effectively $0 | More robust scheduling — retries, dead-letter queues, monitoring. |
| 21 | Amazon Bedrock (Claude) | Direct Anthropic API | P1 | 2 hrs | Same per-token pricing as Anthropic direct. No markup. | Enterprise-grade AI access with built-in guardrails and usage tracking. |
| 22 | Amazon RDS PostgreSQL / Aurora Serverless | Neon | P2 | 3 hrs | RDS free tier: 750 hrs/mo db.t3.micro. Aurora Serverless: ~$0.06/ACU-hr, scales to zero | Shows you can operate in enterprise AWS environments. |
| 23 | Amazon Cognito | Auth.js | P2 | 1 day | Free tier: 50,000 MAU. Effectively $0 | Unlocks MFA, social login (Google/Apple), user pools — all listed in PRD future phases. |

### New Features

| # | Service | Feature | Priority | Effort | Cost (monthly) | Product Reason |
|---|---------|---------|----------|--------|----------------|----------------|
| 24 | S3 + CloudFront | Receipt photo upload & storage | P0 | 3 hrs | S3 free tier: 5GB. CloudFront free tier: 1TB transfer. Effectively $0 | Bridges paper-to-digital gap for vendors with register tapes. Storage for future OCR. |
| 25 | Amazon Textract | OCR receipt parsing | P0 | 3 hrs | Free tier: 1,000 pages/mo for 3 months. Then ~$1.50/1,000 pages | Hands-free sales logging — photo → text → parser → structured data. High-impact feature. |
| 26 | Amazon SNS | Morning prep push notifications | P1 | 3 hrs | Free tier: 1M publishes, 1,000 SMS. Effectively $0 | "Prep 42 bread for today" at 6 AM — genuinely useful for vendors who prep early. |
| 27 | Amazon Translate | Auto-translate insights & chat | P2 | 2 hrs | Free tier: 2M chars/mo for 12 months. Then ~$15/M chars | i18n architecture is ready. Translate LLM-generated content for multilingual vendors. |
| 28 | Amazon DynamoDB | Persistent chat history | P2 | 2 hrs | Free tier: 25GB storage, 25 read/write units. Effectively $0 | Users can reference past AI conversations across sessions. |

### Infrastructure & Operations

| # | Service | Purpose | Priority | Effort | Cost (monthly) | Product Reason |
|---|---------|---------|----------|--------|----------------|----------------|
| 29 | AWS CloudWatch | Monitoring, metrics, alerting | P1 | 2 hrs | Free tier: 10 custom metrics, 10 alarms. Effectively $0 | Operational visibility — API error rates, response times, LLM failure alerts. |
| 30 | AWS Secrets Manager | API key management | P1 | 1 hr | ~$0.40/secret/mo. ~$1.60 for 4 secrets | Security best practice — key rotation without redeployment. |
| 31 | AWS Lambda | Background processing (insights, predictions) | P2 | 4 hrs | Free tier: 1M requests, 400,000 GB-sec/mo. Effectively $0 | Offload heavy computation from web server. Faster dashboard loads. |

---

## AWS Priority Summary

### P0 — Do first
19. SES (replace Resend) — quick swap, free tier covers demo usage
24. S3 + CloudFront (receipt uploads) — foundation for OCR feature
25. Textract (receipt OCR) — high-impact feature, chains with existing parser

### P1 — High value
20. EventBridge (replace Vercel Cron) — more robust scheduling
21. Bedrock (replace direct Anthropic) — enterprise AI access
26. SNS (push notifications) — real user value for morning prep
29. CloudWatch (monitoring) — operational visibility
30. Secrets Manager — security best practice

### P2 — Nice to have
22. RDS/Aurora (replace Neon) — enterprise database
23. Cognito (replace Auth.js) — MFA + social login
27. Translate (auto-translate) — multilingual support
28. DynamoDB (chat history) — persistent conversations
31. Lambda (background processing) — serverless compute

### Cost Summary
At portfolio/demo scale with free tiers: most services cost $0-2/month. The only meaningful costs are Textract after the 3-month free tier (~$1.50/1,000 pages) and Secrets Manager (~$1.60/mo). Total estimated: under $5/month on top of what you already spend.
