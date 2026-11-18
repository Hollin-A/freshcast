import { type ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard, type ThrottlerLimitDetail } from "@nestjs/throttler";
import type { AuthenticatedRequest } from "../auth/auth-context.js";
import { ApiException } from "../common/api-exception.js";

/**
 * The global rate limiter (ADR-023 §9). Signed-in requests are counted per
 * business, so a business's users share one allowance and two businesses
 * never share one. Before onboarding they're counted per user, and
 * anonymous requests per client IP (`trust proxy`, see main.ts).
 *
 * It reads the session SessionGuard attached, so it must run after it:
 * RateLimitModule is imported after AuthModule (see rate-limit.guard.test.ts).
 * Requests SessionGuard rejects are not counted.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected override async getTracker(req: AuthenticatedRequest): Promise<string> {
    if (req.auth?.business) return `business:${req.auth.business.id}`;
    if (req.auth) return `user:${req.auth.userId}`;
    // The base tracker normalises the IP (IPv6 addresses by /64 subnet).
    return `ip:${await super.getTracker(req)}`;
  }

  // The base guard has already set Retry-After (seconds) on the response.
  protected override throwThrottlingException(
    _context: ExecutionContext,
    { timeToBlockExpire }: ThrottlerLimitDetail
  ): Promise<void> {
    throw new ApiException(
      "RATE_LIMITED",
      `Too many requests. Try again in ${timeToBlockExpire} ${timeToBlockExpire === 1 ? "second" : "seconds"}.`,
      429
    );
  }
}
