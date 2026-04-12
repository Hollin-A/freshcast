import { NextResponse } from "next/server";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { logger } from "./logger";

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse<ApiError> {
  if (status >= 500) {
    logger.error("api", `${code}: ${message}`, details);
  } else if (status >= 400) {
    logger.warn("api", `${code}: ${message}`, details);
  }
  return NextResponse.json(
    { error: { code, message, details } },
    { status }
  );
}

/**
 * Get the authenticated user's businessId from the session.
 * Returns null if not authenticated or no business exists.
 */
export async function getBusinessId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  return business?.id ?? null;
}

/**
 * Get the authenticated user's business context (id + timezone).
 * Returns null if not authenticated or no business exists.
 */
export async function getBusinessContext(): Promise<{
  businessId: string;
  timezone: string;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { id: true, timezone: true },
  });

  if (!business) return null;
  return { businessId: business.id, timezone: business.timezone };
}
