# ADR-014: Multiple Sales Entries Per Day

## Status
Accepted

## Date
2026-04-12

## Context

The original design enforced one sales entry per day via a `@@unique([businessId, date])` constraint. Users who logged sales in batches (morning and afternoon) would have their first entry overwritten.

## Decision

Remove the unique constraint and allow multiple sales entries per day. Each entry is a separate record with its own timestamp.

## Rationale

- Matches how vendors actually work — they log in batches, not all at once
- Simpler API — POST always creates, no upsert logic needed
- Full audit trail — users can see exactly what they logged and when
- Analytics already aggregate by date range, so they naturally sum across multiple entries

## Consequences

- `getTodaySummary` must aggregate across multiple entries (uses `findMany` + merge)
- Sales history groups entries by date with time display
- No data loss risk from accidental overwrites
