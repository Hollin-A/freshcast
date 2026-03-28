# ADR-002: Dual-Mode Sales Input (Natural Language + Manual Form)

## Status
Accepted

## Date
2026-03-29

## Context

The core feature of BizSense is sales logging. The original concept was natural language input only ("I sold 20 eggs, 30kg beef"). However, we need to consider:

- Not all users will be comfortable typing free-form text
- NL parsing can misinterpret input, causing frustration
- Some users prefer structured, predictable interfaces
- The app's value prop is "ultra-simple logging" — restricting to one method limits accessibility

Options considered:

1. **Natural language only** — differentiating but risky if parsing fails
2. **Manual form only** — safe but loses the "wow factor" and speed advantage
3. **Dual mode (NL + manual form)** — user chooses their preferred method

## Decision

Provide both natural language input and manual form input, accessible from the same screen via a tab or toggle. Natural language is the default/promoted mode.

## Rationale

- Dual mode gives users choice, which increases adoption across different comfort levels
- NL input remains the differentiator and primary promoted experience
- Manual form acts as a safety net — builds trust that users can always fall back to something predictable
- The confirmation screen (shared by both modes) catches parsing errors before data is saved
- Manual form also validates the core concept: if users engage with the structured form, the product still delivers value even without NL parsing

## Consequences

- Two input paths to build and maintain in MVP
- Shared confirmation/review screen reduces duplication
- NL parser errors are less critical since manual form exists as fallback
- Need clear UX to avoid confusion about which mode to use (default to NL, manual as secondary tab)
- Slightly more frontend work, but backend is identical (both produce the same structured data)

## Future Considerations

- Phase 2: Upgrade NL parser from rule-based to AI-powered
- Phase 2: Add voice input as a third mode
- Usage analytics on mode preference can inform future investment
