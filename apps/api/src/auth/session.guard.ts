import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ClsService } from "nestjs-cls";
import { PinoLogger } from "nestjs-pino";
import { ApiException } from "../common/api-exception.js";
import { IS_PUBLIC_KEY } from "../common/public.decorator.js";
import type { RequestContext } from "../database/business-context.js";
import { PrismaService } from "../database/prisma.service.js";
import type { AuthenticatedRequest } from "./auth-context.js";
import { SessionCookieReader } from "./session-cookie.js";

/**
 * Global guard: every route needs a valid session unless it is marked
 * @Public(). Resolves the user and their business once per request, so
 * @CurrentUser() and @CurrentBusiness() read it without another query, and
 * puts the business in the request context for the scoped Prisma client
 * and the request's log lines (`businessId`, so per-Business LLM cost can
 * be queried from `llm.call` lines).
 * This is the auth bridge: it uses the unscoped PrismaService because the
 * business isn't known until the query returns.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cookies: SessionCookieReader,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService<RequestContext>,
    private readonly logContext: PinoLogger
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = await this.cookies.userId(request.headers);
    if (!userId) throw unauthorized();

    // The cookie stays valid after the account is deleted, so check the
    // user still exists. One query, joined with the business.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, business: { select: { id: true, timezone: true, region: true } } },
    });
    if (!user) throw unauthorized();

    request.auth = { userId: user.id, business: user.business };
    this.cls.set("userId", user.id);
    if (user.business) {
      this.cls.set("businessId", user.business.id);
      this.logContext.assign({ businessId: user.business.id });
    }
    return true;
  }
}

function unauthorized(): ApiException {
  return new ApiException("UNAUTHORIZED", "Sign in to continue.", 401);
}
