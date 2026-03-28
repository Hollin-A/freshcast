# ADR-005: Daily Batch Processing Over Real-Time Insights

## Status
Accepted

## Date
2026-03-29

## Context

The dashboard displays AI insights, trend summaries, and demand predictions. We need to decide when and how these are computed.

Options considered:

1. **Real-time computation** — insights update immediately as sales are logged; engaging but adds server load, complexity, and cost (frequent AI API calls)
2. **Daily batch processing** — insights generated once per day (e.g., overnight or on first app open); simpler, cheaper, predictable
3. **Event-driven with caching** — compute on sales save, cache until next change; moderate complexity

## Decision

Daily batch processing for all insights, predictions, and trend calculations in MVP.

## Rationale

- Most small vendors log sales once per day (end of day), so real-time updates provide minimal additional value
- Batch processing is simpler to implement, test, and debug
- Reduces AI API costs significantly (one call per business per day vs. per interaction)
- Predictable server load — no spikes during peak logging times
- Dashboard pulls the latest batch result on app open, which feels fresh enough for daily-use patterns
- Aligns with the user flow: log sales → close app → open next day → see updated insights

## Implementation Approach

- Batch job runs daily (triggered by cron or on first app open if stale)
- Computes: today's summary, weekly trends, week-over-week comparison, top products, demand forecasts, NL insight strings
- Results stored in `DailyInsight` and `DemandForecast` tables
- Dashboard reads from these tables (fast, no computation on render)

## Consequences

- Insights won't reflect sales logged "just now" until the next batch run
- Need a clear UX indicator: "Insights updated daily" or "Last updated: [timestamp]"
- If a user logs sales and immediately checks the dashboard, they'll see yesterday's insights (acceptable given the daily-use pattern)
- Simpler error handling — if batch fails, previous day's insights remain visible

## Future Considerations

- Could add a "refresh insights" button that triggers an on-demand batch for the current user
- Event-driven approach could be layered on for specific high-value metrics if needed
- Real-time updates become more relevant if multi-user support is added (employee logs sale, owner sees it immediately)
