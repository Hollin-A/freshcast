import { type ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from "@nestjs/throttler";
import type { AuthenticatedRequest } from "../auth/auth-context.js";
import { ApiException } from "../common/api-exception.js";
import type { Env } from "../config/env.schema.js";
import { clientIp } from "./client-ip.js";

/**
 * The rate limiter (ADR-023 §9). Signed-in requests are counted per
 * business, so a business's users share one allowance and two businesses
 * never share one. Before onboarding they're counted per user, and
 * anonymous requests per client IP (see client-ip.ts).
 *
 * It reads the session SessionGuard attached, so RequestGuard runs it after
 * SessionGuard. It isn't a global guard of its own.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  private readonly proxySecret: string | undefined;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    config: ConfigService<Env, true>
  ) {
    super(options, storage, reflector);
    this.proxySecret = config.get("PROXY_SECRET", { infer: true });
  }

  protected override async getTracker(req: AuthenticatedRequest): Promise<string> {
    if (req.auth?.business) return `business:${req.auth.business.id}`;
    if (req.auth) return `user:${req.auth.userId}`;
    // The base tracker normalises the IP (IPv6 addresses by /64 subnet).
    return `ip:${await super.getTracker({ ip: clientIp(req, this.proxySecret) })}`;
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
