import { hours, minutes, Throttle } from "@nestjs/throttler";

/**
 * Rate limits sized to each route's cost (ADR-023 §9). Each route keeps its
 * own count per business (or per IP when anonymous); a request doesn't use
 * up another route's allowance.
 */
export const RATE_LIMITS = {
  /** Every route unless it says otherwise: CRUD reads and writes. */
  standard: { limit: 120, ttl: minutes(1) },
  /** Routes that call Claude or OCR, where each request costs money. */
  costly: { limit: 30, ttl: hours(1) },
} as const;

/**
 * Applies a stricter limit to a route or controller, e.g. `@RateLimit("costly")`
 * on sales parsing, receipt parsing, chat and insight generation.
 */
export const RateLimit = (preset: keyof typeof RATE_LIMITS) =>
  Throttle({ default: RATE_LIMITS[preset] });
