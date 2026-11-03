import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseModule } from "../database/database.module.js";
import { SessionCookieReader } from "./session-cookie.js";
import { SessionGuard } from "./session.guard.js";

/** Session authentication for every route; opt out with @Public(). */
@Module({
  imports: [DatabaseModule],
  providers: [SessionCookieReader, { provide: APP_GUARD, useClass: SessionGuard }],
})
export class AuthModule {}
