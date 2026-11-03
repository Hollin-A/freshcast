import type { Request } from "express";

/** The business a session belongs to, as handlers need it (ADR-008). */
export interface SessionBusiness {
  id: string;
  timezone: string;
  region: string;
}

/** What SessionGuard attaches to an authenticated request. */
export interface AuthContext {
  userId: string;
  /** Null until the user finishes onboarding. */
  business: SessionBusiness | null;
}

export type AuthenticatedRequest = Request & { auth?: AuthContext };
