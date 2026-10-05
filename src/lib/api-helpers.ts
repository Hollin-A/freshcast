import { NextResponse } from "next/server";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { logger } from "./logger";
import type { ApiErrorBody, ApiSuccess } from "@/schemas";

/** Success response in the standard envelope: `{ data, meta? }`. */
export function ok<T>(
  data: T,
  init: { status?: number; meta?: Record<string, unknown> } = {}
): NextResponse<ApiSuccess<T>> {
  const body: ApiSuccess<T> = init.meta ? { data, meta: init.meta } : { data };
  return NextResponse.json(body, { status: init.status ?? 200 });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse<ApiErrorBody> {
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
  region: string;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { id: true, timezone: true, region: true },
  });

  if (!business) return null;
  return { businessId: business.id, timezone: business.timezone, region: business.region };
}
