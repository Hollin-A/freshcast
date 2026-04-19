# ADR-016: Editorial Rebrand — Warm Palette & Serif Typography

## Status
Accepted

## Date
2026-04-19

## Context

Freshcast launched with a teal/Geist theme — clean and functional, but generic. The app targets small fresh-goods vendors (butchers, market stalls, bakeries) who value warmth and approachability over corporate polish. The current UI doesn't reflect the brand personality described in the PRD: "farmers' market", "low friction over completeness", "AI as assistant, not replacement."

A redesign was prototyped in Claude Design (`docs/rebranding/`) with a warm editorial direction — cream paper backgrounds, terracotta accents, serif headings, and earthy tones. The goal is a visual refresh that feels like a trusted morning newspaper for your market stall, not a SaaS dashboard.

## Decision

Replace the current teal/Geist visual language with a warm editorial design system:

- **Palette**: Cream (`#F5EFE3`) canvas, paper (`#FAF6EC`) cards, ink (`#1E1A14`) text, terracotta (`#B5553A`) primary, olive (`#6B7A3A`) secondary, with clay, harvest, plum, and sage accents
- **Typography**: Fraunces (serif) for headings and big numbers, system sans (or Inter) for body, JetBrains Mono for data/stats
- **Components**: Pill-shaped buttons, warm-bordered cards (18px radius), frosted glass tab bar, editorial section labels
- **Tone**: Farmers' market editorial — warm, confident, approachable

## Implementation

- Pure UI/CSS changes — no API, service, or data model modifications
- Implemented as Phase 21 in the implementation plan with 8 sub-phases
- Single branch (`feat/rebrand-editorial`) with commits per sub-phase
- shadcn/ui components restyled via CSS custom properties and Tailwind theme
- Existing i18n architecture preserved (string keys may be updated if labels change)

## Rationale

- The warm palette aligns with the target audience (fresh goods vendors, market operators)
- Serif typography adds editorial authority to forecasts and insights — "trust the morning number"
- Terracotta as primary CTA is distinctive and warm without being aggressive
- The dark forecast hero card creates visual hierarchy — tomorrow's prep is the most important thing
- No structural changes means low risk — if the rebrand doesn't land, it's reversible at the CSS level

## What we explicitly excluded

- Dark mode (deferred — the warm palette is inherently light-mode; dark mode would need a separate pass)
- New features or screens — this is strictly visual
- Logo/icon redesign for PWA — only colors updated in manifest
- Animation or motion design — keep it calm and fast

## Consequences

- All screenshots in docs and README will need updating after the rebrand
- The PWA splash screen and manifest colors will change
- Users familiar with the teal theme will see a different look (acceptable for a pre-launch product)
- Future components should follow the warm editorial tokens, not the old teal palette
