import { NextResponse } from "next/server";
import { auth } from "./auth";
import { prisma } from "./prisma";

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
