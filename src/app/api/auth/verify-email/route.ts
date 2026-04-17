import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    const email = request.nextUrl.searchParams.get("email");

    if (!token || !email) {
      return errorResponse("VALIDATION_ERROR", "Invalid verification link", 400);
    }

    const stored = await prisma.verificationToken.deleteMany({
      where: { identifier: `verify:${email}`, token },
    });

    if (stored.count === 0) {
      return errorResponse("VALIDATION_ERROR", "Invalid or expired verification link", 400);
    }

    await prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });

    logger.info("auth", "Email verified", { email });

    // Redirect to settings with success message
    return NextResponse.redirect(
      new URL("/settings?verified=true", request.url)
    );
  } catch (err) {
    logger.error("auth", "GET /api/auth/verify-email failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
