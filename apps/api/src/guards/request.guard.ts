import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard.js";
import { RateLimitGuard } from "../rate-limit/rate-limit.guard.js";

/**
 * The one global guard. It runs SessionGuard and then RateLimitGuard in
 * that order, because the rate limiter keys counts by the session that
 * SessionGuard attaches. Nest runs separate global guards in module-scan
 * order, so composing them here keeps the order out of AppModule's imports.
 *
 * Requests SessionGuard rejects are still counted (by client IP, as there is
 * no session), so an unauthenticated client can't call protected routes
 * without limit. Over the limit, the 429 replaces the 401.
 */
@Injectable()
export class RequestGuard implements CanActivate {
  constructor(
    private readonly session: SessionGuard,
    private readonly rateLimit: RateLimitGuard
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await this.session.canActivate(context);
    } catch (err) {
      await this.rateLimit.canActivate(context);
      throw err;
    }
    return this.rateLimit.canActivate(context);
  }
}
