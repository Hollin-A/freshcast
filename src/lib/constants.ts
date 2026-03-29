export const BUSINESS_TYPES = [
  "RETAIL_VENDOR",
  "BUTCHER",
  "PRODUCE_SELLER",
  "MARKET_STALL",
  "GROCERY",
  "CAFE",
  "TAKEAWAY",
  "OTHER",
] as const;

export const KNOWN_UNITS = [
  "kg",
  "g",
  "lbs",
  "lb",
  "liters",
  "l",
  "ml",
  "gallons",
  "pieces",
  "pcs",
  "dozen",
  "units",
] as const;

export const MIN_ENTRIES_FOR_PREDICTIONS = 5;

export const INSIGHT_STALE_HOURS = 24;
