# ADR-004: Quantity-Only Tracking (No Pricing in MVP)

## Status
Accepted

## Date
2026-03-29

## Context

Traditional sales tracking systems capture both quantity and price/revenue. We need to decide whether BizSense should track pricing data.

Options considered:

1. **Quantity + price tracking** — enables revenue dashboards, profit analysis, but adds input friction and data model complexity
2. **Quantity-only tracking** — simpler input, cleaner data model, focused on the core value prop (demand prediction)
3. **Optional pricing** — quantity required, price optional — flexible but creates inconsistent data

## Decision

Quantity-only tracking for MVP, and potentially throughout the product lifecycle. Pricing is a future consideration only if user demand warrants it.

## Rationale

- The core differentiator is quantity-based demand prediction ("bring 25 eggs tomorrow"), not revenue analysis
- Adding price fields increases input friction — directly conflicts with the "< 30 seconds" logging goal
- Small vendors often have variable/negotiated pricing that's hard to capture accurately
- Quantity data alone is sufficient for all MVP features: trends, predictions, insights
- Keeps the data model clean and the input experience minimal
- Users who need revenue tracking likely need a full POS system (which is explicitly a non-goal)

## Consequences

- No revenue metrics, profit margins, or financial dashboards
- Insights are purely quantity-based ("egg sales up 15%" means quantity, not revenue)
- Simpler data model (no price field, no currency handling)
- Faster input experience
- Some users may eventually want pricing — this is an additive change that doesn't break existing data

## Future Considerations

- If pricing is added later, it would be optional per product with a default price
- Revenue tracking would be a separate dashboard section, not mixed into quantity insights
- Currency/locale handling would need to be addressed at that point
