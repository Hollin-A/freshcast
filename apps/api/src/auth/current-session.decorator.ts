import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { ApiException } from "../common/api-exception.js";
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
 * The signed-in user's business. Handlers scope every query by its `id` and
 * never take a business ID from the request (ADR-008). Answers 403
 * BUSINESS_REQUIRED if the user hasn't finished onboarding.
 */
export const CurrentBusiness = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionBusiness => {
    const { business } = authOf(context);
    if (!business) {
      throw new ApiException(
        "BUSINESS_REQUIRED",
        "Set up your business before using this feature.",
        403
      );
    }
    return business;
  }
);

function authOf(context: ExecutionContext): AuthContext {
  const { auth } = context.switchToHttp().getRequest<AuthenticatedRequest>();
  // Only possible on a @Public() route, which is a programming error.
  if (!auth) throw new Error("@CurrentUser()/@CurrentBusiness() used on a route without a session");
  return auth;
}
