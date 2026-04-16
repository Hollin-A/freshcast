# ADR-011: LLM Integration with Claude Haiku

## Status
Accepted (supersedes ADR-003 for NL parsing, extends ADR-005 for insights)

## Date
2026-04-15

## Context

The MVP launched with a rule-based NL parser (ADR-003) and template-based insight generator (ADR-005). Both worked well for common cases but had limitations:

- The rule-based parser struggled with conversational input ("I think I sold about two dozen eggs")
- Template insights were repetitive and lacked natural variation
- The PRD's future phases called for AI-powered parsing and more natural insights

We needed to choose an LLM provider and integration strategy.

## Decision

Integrate Claude 3.5 Haiku (Anthropic) for both NL sales parsing and insight generation, with graceful fallback to the existing rule-based/template logic.

Model: `claude-haiku-4-5-20251001` ($1/M input, $5/M output)

## Rationale

- Claude over OpenAI: the developer already had an Anthropic console account, reducing setup friction
- Haiku over Sonnet/Opus: cheapest model, sufficient quality for structured extraction and short-form generation. Pennies per month for a single-user app.
- Fallback pattern: both features work without the API key (rule-based parser, template insights). This means the app never breaks if the LLM is unavailable, the API key isn't set, or the service is overloaded.
- Shared client: a single `src/lib/claude.ts` utility serves both features with `generateText` and `generateJSON` helpers.

## Implementation

- `src/lib/claude.ts` — shared Claude client with JSON extraction and error handling
- `src/services/llm-sales-parser.ts` — LLM parser that returns the same `ParsedItem[]` format
- `src/services/insight-generator.ts` — tries LLM first, falls back to templates
- `generationMethod` field on DailyInsight tracks which method produced each insight
- `parseMethod` field in parse API response indicates which parser was used

## Consequences

- API cost per parse call (~$0.001) — acceptable at Haiku pricing
- Insight generation capped at 1 LLM call per business per day (cached in DB)
- Added ~500ms latency to NL parsing when LLM is used (acceptable with loading indicator)
- Rule-based parser remains as production-quality fallback
