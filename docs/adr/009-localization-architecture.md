# ADR-009: Localization-Ready Architecture from Day One

## Status
Accepted

## Date
2026-03-29

## Context

BizSense targets small retail businesses that may operate in non-English-speaking regions. While MVP launches in English only, we need to decide whether to build localization into the architecture now or retrofit later.

Options considered:

1. **Hardcoded English strings, localize later** — fastest for MVP but creates significant technical debt; retrofitting i18n into an existing app is painful and error-prone
2. **Localization-ready architecture from day one** — externalize all strings, use i18n library, respect locale formatting; small upfront cost, massive savings later
3. **Full multi-language support in MVP** — complete translations for multiple languages; too much scope for MVP

## Decision

Localization-ready architecture from day one. English only for MVP, but all user-facing strings externalized and locale-aware formatting in place.

## Rationale

- Retrofitting i18n into an existing codebase is one of the most painful refactors in frontend development
- Externalizing strings from the start is a small incremental cost per component (minutes, not hours)
- Date, number, and unit formatting differences across locales can cause subtle bugs if not handled early
- The target market (small vendors) is global — localization is a when, not an if
- next-intl integrates cleanly with Next.js App Router

## Implementation Approach

1. Use `next-intl` (or equivalent) for string externalization
2. All user-facing text in JSON message files (e.g., `messages/en.json`)
3. Date formatting via `Intl.DateTimeFormat` (locale-aware)
4. Number formatting via `Intl.NumberFormat` (locale-aware)
5. Unit display respects locale preferences
6. RTL layout support considered in Tailwind config (logical properties: `ms-`, `me-` instead of `ml-`, `mr-`)
7. Locale preference stored in Business model

## Consequences

- Slightly more boilerplate per component (use translation keys instead of raw strings)
- Need to maintain message files even for English-only MVP
- RTL consideration adds minor CSS complexity
- Adding a new language becomes a translation task, not an engineering task

## Future Considerations

- Additional language packs based on target market research
- Locale-specific unit defaults (kg vs. lbs, liters vs. gallons)
- Localized AI insight generation (generate insights in user's language)
- Community-contributed translations
