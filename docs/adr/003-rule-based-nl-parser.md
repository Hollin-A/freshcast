# ADR-003: Rule-Based Natural Language Parser for MVP

## Status
Accepted

## Date
2026-03-29

## Context

The natural language sales input feature requires parsing free-form text like "sold 20 eggs, 30kg minced beef" into structured data. We need to decide the parsing approach.

Options considered:

1. **AI/LLM-based parsing (OpenAI API)** — highly flexible, handles ambiguous input well, but adds API cost per parse, latency, and external dependency for a core feature
2. **Rule-based / regex parser** — predictable, fast, free, works offline, but less flexible with unusual phrasing
3. **Hybrid (rule-based with AI fallback)** — best of both but adds complexity

## Decision

Rule-based parser for MVP. AI-powered parsing deferred to Phase 2.

## Rationale

- Sales input follows predictable patterns: `[quantity] [unit?] [product name]`
- Rule-based parsing is fast (no API latency), free (no per-call cost), and deterministic
- The confirmation screen catches edge cases — users can edit parsed results before saving
- Manual form input exists as a fallback for inputs the parser can't handle
- Avoids making a core feature dependent on an external API (OpenAI) for every single interaction
- AI API budget is better spent on insight generation and predictions where the value-add is higher

## Parsing Strategy

The parser will handle patterns like:
- "20 eggs" → { product: "Eggs", quantity: 20 }
- "30kg minced beef" → { product: "Minced beef", quantity: 30, unit: "kg" }
- "sold 10 milk bottles and 5 bread loaves" → multiple items

Core logic:
1. Split input by commas and conjunctions ("and")
2. Extract quantity (number) and optional unit (kg, liters, etc.)
3. Remaining text = product name
4. Fuzzy match against existing product list
5. Flag unmatched products as "new" for user confirmation

## Consequences

- Parser won't handle highly ambiguous or conversational input ("I think I sold about two dozen eggs maybe")
- Limited to patterns the rules cover — edge cases fall through to manual correction
- No API cost for the most frequently used feature
- Deterministic behavior makes testing straightforward
- Clear upgrade path to AI parsing in Phase 2

## Future Considerations

- Phase 2: Replace or augment with AI-powered parsing for better flexibility
- Track parser failure rate to inform when the upgrade is needed
- Consider a hybrid approach where rule-based handles common patterns and AI handles fallback
