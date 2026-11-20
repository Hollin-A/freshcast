import type { ClsService, ClsStore } from "nestjs-cls";
import { ApiException } from "../common/api-exception.js";
import { ScopeViolationError } from "./business-scope.js";

/**
 * What the request context holds (nestjs-cls, one per request).
 * SessionGuard fills it from the session; nothing is taken from the request
 * itself (ADR-008).
 */
export interface RequestContext extends ClsStore {
  /** Set once SessionGuard accepts the session. */
  userId?: string;
  /** Also unset before onboarding. */
  businessId?: string;
}

/**
 * The current request's Business ID, for the scoped client. Never lets a
 * query run unscoped:
 * - signed in before onboarding: 403 BUSINESS_REQUIRED, as
 *   @CurrentBusiness() answers;
 * - no session at all (a @Public() route, or outside a request such as a
 *   job): ScopeViolationError, a programming error and so a 500.
 */
export function currentBusinessId(cls: ClsService<RequestContext>): string {
  const businessId = cls.isActive() ? cls.get("businessId") : undefined;
  if (businessId) return businessId;
  if (cls.isActive() && cls.get("userId")) {
    throw businessRequired();
  }
  throw new ScopeViolationError("The scoped client needs a session with a Business");
}

/** 403 for a signed-in user who hasn't finished onboarding. */
export function businessRequired(): ApiException {
  return new ApiException("BUSINESS_REQUIRED", "Set up your business before using this feature.", 403);
}
