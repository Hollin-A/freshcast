import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { SessionCookieReader } from "./session-cookie.js";
import { SessionGuard } from "./session.guard.js";

/**
 * Session authentication. SessionGuard runs on every route (opt out with
 * @Public()), through RequestGuard in GuardsModule.
 */
@Module({
  imports: [DatabaseModule],
  providers: [SessionCookieReader, SessionGuard],
  exports: [SessionGuard],
})
export class AuthModule {}
