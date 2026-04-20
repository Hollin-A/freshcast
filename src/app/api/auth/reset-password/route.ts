import { NextResponse } from "next/server";
import * as z from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

const schema = z.object({
  email: z.email({ error: "Invalid email" }),
  token: z.string().min(1),
  password: z.string().min(8, { error: "Password must be at least 8 characters" }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", 400, {
        fields: result.error.flatten().fieldErrors,
      });
    }

    const { email, token, password } = result.data;

    // Check if this is a demo account
    const user = await prisma.user.findUnique({
      where: { email },
      select: { isDemo: true },
    });
    if (user?.isDemo) {
      return errorResponse("FORBIDDEN", "Demo account password cannot be changed", 403);
    }

    // Use a transaction: find token, validate, delete, update password — atomically
    const success = await prisma.$transaction(async (tx) => {
      // Delete the token immediately to prevent reuse in a race
      const deleted = await tx.verificationToken.deleteMany({
        where: { identifier: email, token },
      });

      if (deleted.count === 0) return false;

      // Clean up any other tokens for this email
      await tx.verificationToken.deleteMany({
        where: { identifier: email },
      });

      // Update password
      const passwordHash = await bcrypt.hash(password, 12);
      await tx.user.update({
        where: { email },
        data: { passwordHash },
      });

      return true;
    });

    if (!success) {
      return errorResponse("VALIDATION_ERROR", "Invalid or expired reset link", 400);
    }

    logger.info("auth", "Password reset successful", { email });
    return NextResponse.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    logger.error("auth", "POST /api/auth/reset-password failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
