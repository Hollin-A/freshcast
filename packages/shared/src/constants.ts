// Constants the shared schemas depend on. Imported by both apps.

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

// Receipt photos larger than this are rejected (validated by the API and
// enforced by S3 through the signed Content-Length on the upload URL).
export const RECEIPT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
