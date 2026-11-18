import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ThrottlerModule } from "@nestjs/throttler";
import { RateLimitGuard } from "./rate-limit.guard.js";
import { RATE_LIMITS } from "./rate-limits.js";

/**
 * Rate limiting for every route (ADR-020 D8, ADR-023 §9). Opt out with
 * @SkipThrottle(); tighten with @RateLimit("costly").
 *
 * Counts are kept in the task's memory, which is correct only while the
 * service runs one ECS task: with two, each task would allow the full limit.
 * A shared Redis store (@nest-lab/throttler-storage-redis) comes with the
 * second task.
 *
 * Import after AuthModule: global guards run in registration order, and the
 * guard reads the session that SessionGuard attaches.
 */
@Module({
  imports: [ThrottlerModule.forRoot({ throttlers: [RATE_LIMITS.standard] })],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class RateLimitModule {}

/**
 * Takes the client IP from the X-Forwarded-For entry added by the one proxy
 * in front of the API (the ALB), so anonymous clients are limited per IP
 * rather than all sharing the ALB's address. Entries further left are set by
 * the client and can't be trusted.
 */
export function trustProxy(app: NestExpressApplication): void {
  app.set("trust proxy", 1);
}
