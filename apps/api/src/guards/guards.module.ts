import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "../auth/auth.module.js";
import { RateLimitModule } from "../rate-limit/rate-limit.module.js";
import { RequestGuard } from "./request.guard.js";

/**
 * Registers RequestGuard, which runs session authentication and then rate
 * limiting on every route. No other module registers an APP_GUARD.
 */
@Module({
  imports: [AuthModule, RateLimitModule],
  providers: [{ provide: APP_GUARD, useClass: RequestGuard }],
})
export class GuardsModule {}
