import { hours, minutes, Throttle } from "@nestjs/throttler";

/**
 * Rate limits sized to each route's cost (ADR-023 §9). Each route keeps its
 * own count per business (per user before onboarding, per IP when
 * anonymous); a request doesn't use up another route's allowance.
 *
 * The window slides: a request over the limit is refused until the oldest
 * counted request is `ttl` old, and refused requests aren't counted.
 * (`blockDuration: 0`; by default the throttler would block for a full
 * `ttl` from the request that went over.)
 */
export const RATE_LIMITS = {
  /** Every route unless it says otherwise: CRUD reads and writes. */
  standard: { limit: 120, ttl: minutes(1), blockDuration: 0 },
  /** Routes that call Claude or OCR, where each request costs money. */
  costly: { limit: 30, ttl: hours(1), blockDuration: 0 },
} as const;

/**
 * Applies a stricter limit to a route or controller, e.g. `@RateLimit("costly")`
 * on sales parsing, receipt parsing, chat and insight generation.
 */
export const RateLimit = (preset: keyof typeof RATE_LIMITS) =>
  Throttle({ default: RATE_LIMITS[preset] });
