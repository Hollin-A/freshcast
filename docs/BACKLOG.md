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
| 35 | Receipt OCR hardening — LLM-only fallback + AnalyzeExpense migration (ADR-019) | P0 | ✅ Done | 36 |

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
| 24 | S3 + CloudFront | Receipt photo upload & storage | ✅ Done | 29 |
| 25 | Amazon Textract | OCR receipt parsing | ✅ Done | 29 |
| 26 | Amazon SNS | Morning prep push notifications | 🔲 Planned | 31 |
| 27 | Amazon Translate | Auto-translate insights & chat | 🔲 Planned | 33 |
| 28 | Amazon DynamoDB | Persistent chat history | 🔲 Planned | — |
| 29 | AWS CloudWatch | Monitoring, metrics, alerting | 🔲 Planned | 30 |
| 30 | AWS Secrets Manager | API key management (hybrid env→SM resolver, ADR-018) | ✅ Done | 33 |
| 31 | AWS Lambda | Background processing | 🔲 Planned | — |
| 34 | Amazon Transcribe | Voice-to-text sales logging (Option B async; feeds existing parser pipeline) | 🔲 Planned | 35 |

## AWS Deployment

| # | Item | Status | Phase |
|---|------|--------|-------|
| 32 | AWS Amplify deployment | ✅ Done | 27 |
| 33 | Dockerize the app | ✅ Done | 27 |

---

## Progress Summary

- ✅ Completed: 13 of 35 items (1, 2, 10, 14, 17, 19, 20, 24, 25, 30, 32, 33, 35)
- 🔲 Planned (in implementation plan): 17 items (Phase 35 voice is in the plan when prioritized)
- — Unplanned: 5 items (13, 22, 23, 28, 31 — low priority, no phase assigned)

---

## Voice Input Candidate (Amazon Transcribe — Option B)

Chosen approach: **async transcription** (not live word-by-word streaming). Start a job, return `jobId` immediately, client polls until `COMPLETED`, then transcript is sent through the existing parse flow.

- Record audio on the sales input screen (strict max duration on the client; validate on server)
- Upload audio to S3 (reuse presigned-upload patterns from Phase 29 where sensible)
- **Start** Amazon Transcribe job — API returns **`jobId` right away** (avoids serverless long-request timeouts)
- Client **polls** status endpoint until job completes (or fails)
- Feed final transcript text into existing `POST /api/sales/parse` pipeline (LLM primary, rule-based fallback)
- Reuse the current confirmation/review screen before save (same flow as typed input)

Suggested API shape:

- `POST /api/voice/upload` (or presigned S3 upload, same as receipts) — store audio in S3
- `POST /api/voice/transcribe` — start Transcribe job; response `{ jobId }`
- `GET /api/voice/transcribe/:jobId` — poll job status; when complete, return transcript text (or S3 URI to transcript JSON)

UX notes:

- Keep typed/manual modes as fallback
- Show clear states: recording → uploading → transcribing (poll) → ready to review
- Enforce max recording duration (for cost/latency control)
- **Not** in scope for this backlog item: Transcribe **Streaming** (live partial words while speaking); that would be a separate, heavier phase if ever needed
