# ADR-015: Holiday-Aware Demand Predictions

## Status
Accepted

## Date
2026-04-17

## Context

The prediction engine uses historical sales patterns to forecast demand. However, public holidays significantly affect retail sales — most shops close on Christmas, traffic drops on Anzac Day, and customers stock up the day before long weekends. Without holiday awareness, predictions for these dates would be misleadingly high or low.

## Decision

Add region-based holiday awareness to the prediction engine using a static holiday data file with multipliers applied to the base statistical prediction.

## Implementation

- `region` field on Business model (default: `"AU-VIC"`)
- `src/data/holidays.ts` — static holiday data with 4 types:
  - `closed` (multiplier 0.3): Christmas, Good Friday, etc.
  - `low` (multiplier 0.6): Anzac Day, Boxing Day, Melbourne Cup
  - `pre-holiday` (multiplier 1.2): day before a holiday
  - `post-holiday` (multiplier 1.1): day after a long weekend
- Prediction engine checks forecast date against holiday calendar and applies multiplier
- Dashboard forecast card shows holiday indicator with contextual message

## Rationale

- Holidays are predictable and structured — no AI needed, a lookup table is sufficient
- Multipliers are sensible defaults based on typical retail patterns
- Region is stored per business for future expansion to other states/countries
- Adding a new region requires only adding entries to the holidays data file

## What we explicitly excluded

- Weather impact (requires real-time external data)
- Local events (too unpredictable)
- School terms (marginal impact on retail)
- The line: if it's a fixed calendar date that predictably affects foot traffic, include it

## Consequences

- Predictions for holidays are more realistic
- Holiday data file needs annual updates (or a dynamic source in the future)
- Region defaults to AU-VIC — other regions have no holiday data yet (predictions unaffected)
