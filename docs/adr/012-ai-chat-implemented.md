# ADR-012: AI Chat Interface Implemented

## Status
Accepted (supersedes ADR-010)

## Date
2026-04-15

## Context

ADR-010 deferred the AI chat feature from MVP scope. After completing the LLM integration (ADR-011), the infrastructure was already in place — the Claude client, the analytics services, and the data context builder. Adding chat became low-effort.

## Decision

Implement the AI chat interface using the same Claude Haiku model, with a data context builder that feeds the user's business data into each conversation.

## Rationale

- The Claude client from ADR-011 was already built and tested
- The analytics services already computed all the data the chat needs
- Chat is a high-value portfolio feature that demonstrates the full AI integration
- The data context builder pattern (query relevant data → format as text → send to LLM) is clean and extensible

## Implementation

- `src/services/chat-context.ts` — queries today's sales, weekly totals, previous week comparison, weekday patterns, and product list; formats as structured text
- `POST /api/chat` — accepts message + conversation history, builds context, sends to Claude
- System prompt constrains Claude to only answer based on the user's data
- Conversation history limited to last 8 messages (kept in client state, not DB)
- Suggested questions on empty chat state for discoverability
- Returns 503 gracefully when Claude is unavailable

## Consequences

- Each chat message costs ~$0.002 (context is larger than parse calls)
- No streaming yet — full response returned at once (acceptable for Haiku speed)
- Conversation history is ephemeral (lost on page refresh) — acceptable for MVP
