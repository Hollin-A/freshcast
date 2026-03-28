# ADR-006: Statistical Demand Prediction (No ML in MVP)

## Status
Accepted

## Date
2026-03-29

## Context

Demand prediction is the core differentiator of BizSense — telling vendors what to stock for tomorrow. We need to decide the prediction approach.

Options considered:

1. **Machine learning models** — accurate with enough data, but requires training infrastructure, significant data volume, and ML expertise
2. **Statistical methods (moving averages + weekday patterns)** — simple, interpretable, works with small datasets, no infrastructure overhead
3. **AI/LLM-based predictions** — flexible but expensive per call, non-deterministic, and overkill for pattern-based forecasting

## Decision

Rule-based statistical methods for MVP: simple moving averages combined with weekday pattern detection.

## Rationale

- Small vendors have 5–20 products — statistical methods work well at this scale
- Moving averages and weekday patterns capture the most actionable signals (e.g., "Fridays are strong for beef")
- Predictions can start after just 5–7 days of data — ML models typically need months
- Deterministic and interpretable — users can understand why a prediction was made
- Zero infrastructure overhead (no model training, no GPU, no ML pipeline)
- Sufficient accuracy for the use case: vendors need directional guidance, not precise forecasts

## Prediction Time Horizons

1. **Next day forecast** — most actionable, shown proactively on dashboard
   - Algorithm: weighted moving average of same-weekday sales + recent trend adjustment
2. **Next week overview** — weekday-level breakdown for bulk purchasing planning
   - Algorithm: average quantity per weekday from historical data

## Algorithm Sketch

```
next_day_prediction(product, target_day):
  same_weekday_sales = last 4 occurrences of target_day
  recent_sales = last 7 days
  
  weekday_avg = mean(same_weekday_sales)
  recent_avg = mean(recent_sales)
  
  # Blend weekday pattern with recent trend
  prediction = 0.6 * weekday_avg + 0.4 * recent_avg
  confidence = based on data volume and variance
  
  return { predictedQuantity, confidence }
```

## Consequences

- Predictions won't capture complex patterns (seasonality, events, weather)
- Confidence levels help set user expectations when data is limited
- No external dependencies for the prediction engine
- Easy to test and validate with known datasets
- Clear upgrade path to ML models when data volume justifies it

## Future Considerations

- Phase 4: ML-based forecasting for users with 3+ months of data
- Seasonal pattern detection (holiday spikes, summer vs. winter)
- Event/holiday impact analysis
- A/B test statistical vs. ML predictions to measure accuracy improvement
