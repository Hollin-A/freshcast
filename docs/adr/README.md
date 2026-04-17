# Architecture Decision Records (ADRs) — Freshcast

This directory contains the architectural decisions made for Freshcast.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [001](001-authentication-strategy.md) | Authentication Strategy | Accepted |
| [002](002-sales-input-dual-mode.md) | Dual-Mode Sales Input (NL + Manual Form) | Accepted |
| [003](003-rule-based-nl-parser.md) | Rule-Based Natural Language Parser for MVP | Superseded by ADR-011 |
| [004](004-quantity-only-tracking.md) | Quantity-Only Tracking (No Pricing in MVP) | Accepted |
| [005](005-batch-processing-over-realtime.md) | Daily Batch Processing Over Real-Time Insights | Accepted |
| [006](006-demand-prediction-approach.md) | Statistical Demand Prediction (No ML in MVP) | Accepted |
| [007](007-tech-stack.md) | Technical Stack Selection | Accepted |
| [008](008-data-isolation-privacy.md) | Business Data Isolation & Privacy Model | Accepted |
| [009](009-localization-architecture.md) | Localization-Ready Architecture from Day One | Accepted |
| [010](010-ai-chat-deferred.md) | AI Chat Feature Deferred to Future Phase | Superseded by ADR-012 |
| [011](011-llm-integration-claude.md) | LLM Integration with Claude Haiku | Accepted |
| [012](012-ai-chat-implemented.md) | AI Chat Interface Implemented | Accepted |
| [013](013-timezone-aware-dates.md) | Timezone-Aware Date Handling | Accepted |
| [014](014-multiple-daily-entries.md) | Multiple Sales Entries Per Day | Accepted |
| [015](015-holiday-aware-predictions.md) | Holiday-Aware Demand Predictions | Accepted |

## Format

Each ADR follows the standard format:
- **Status** — Accepted, Superseded, or Deprecated
- **Date** — When the decision was made
- **Context** — What prompted the decision
- **Decision** — What was decided
- **Rationale** — Why this option was chosen
- **Consequences** — Trade-offs and implications
