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

    // Find and validate token
    const stored = await prisma.verificationToken.findFirst({
      where: { identifier: email, token },
    });

    if (!stored) {
      return errorResponse("VALIDATION_ERROR", "Invalid or expired reset link", 400);
    }

    if (stored.expires < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: email, token } },
      });
      return errorResponse("VALIDATION_ERROR", "Reset link has expired. Please request a new one.", 400);
    }

    // Update password
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    // Delete used token
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    });

    logger.info("auth", "Password reset successful", { email });

    return NextResponse.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    logger.error("auth", "POST /api/auth/reset-password failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
