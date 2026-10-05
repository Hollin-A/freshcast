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

// Receipt photos larger than this are rejected (validated by the API and
// enforced by S3 through the signed Content-Length on the upload URL).
export const RECEIPT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
