# ADR-010: AI Chat Feature Deferred to Future Phase

## Status
Superseded by [ADR-012](012-ai-chat-implemented.md) — AI chat implemented in Phase 14

## Date
2026-03-29

## Context

The original concept included an AI chat interface where users could ask business questions like "What sold best this week?" or "When should I prepare more chicken?" We need to decide whether this is MVP scope.

Options considered:

1. **Include AI chat in MVP** — full conversational interface with free-form questions
2. **Include pre-built queries only** — user picks from common questions, no free-form
3. **Defer entirely** — focus on solid data APIs that power dashboards and proactive predictions

## Decision

Defer the AI chat feature entirely from MVP. Focus engineering effort on solid data APIs, dashboard insights, and proactive demand predictions.

## Rationale

- The dashboard and proactive predictions already answer the most common questions ("what's trending?", "what should I stock?") without requiring the user to ask
- AI chat requires significant prompt engineering, context management, and edge case handling
- Each chat interaction costs an API call — ongoing cost for a feature that may see low engagement in early days
- The data APIs built for dashboard/predictions can be reused as the foundation for chat in Phase 3
- Better to ship a polished dashboard with great predictions than a mediocre dashboard + mediocre chat
- Users who need to "ask questions" can read the proactive insights on the dashboard

## Consequences

- No conversational interface in MVP
- Users cannot ask ad-hoc questions about their data
- Proactive insights must be comprehensive enough to cover common questions
- Data APIs must be well-designed for future chat integration (clean separation of concerns)

## Future Considerations

- Phase 3: AI Chat with pre-built query suggestions + free-form input
- Chat will leverage the same data APIs built for dashboard
- Responses constrained to user's own data (privacy model — ADR-008)
