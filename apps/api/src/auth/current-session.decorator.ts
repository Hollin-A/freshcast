import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { businessRequired } from "../database/business-context.js";
import type { AuthContext, AuthenticatedRequest, SessionBusiness } from "./auth-context.js";

export interface SessionUser {
  id: string;
}

/**
 * The signed-in user. For the few routes that work before a business exists,
 * such as creating it during onboarding; everything else uses
 * @CurrentBusiness().
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser => ({ id: authOf(context).userId })
);

/**
 * The signed-in user's business, for what a handler needs to know about it
 * (its timezone, say). Queries don't need its `id`: the scoped Prisma
 * client adds it (ADR-025). Answers 403 BUSINESS_REQUIRED if the user
 * hasn't finished onboarding.
 */
export const CurrentBusiness = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionBusiness => {
    const { business } = authOf(context);
    if (!business) throw businessRequired();
    return business;
  }
);

function authOf(context: ExecutionContext): AuthContext {
  const { auth } = context.switchToHttp().getRequest<AuthenticatedRequest>();
  // Only possible on a @Public() route, which is a programming error.
  if (!auth) throw new Error("@CurrentUser()/@CurrentBusiness() used on a route without a session");
  return auth;
}
