import { flattenError } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, errorResponse } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { resetPasswordRequestSchema } from "@freshcast/shared";
import { withRequestLogging } from "@/lib/request-logging";

async function handlePost(request: Request) {
  try {
    const body = await request.json();
    const result = resetPasswordRequestSchema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", 400, {
        fields: flattenError(result.error).fieldErrors,
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
    return ok({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    logger.error("auth", "POST /api/auth/reset-password failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

export const POST = withRequestLogging(handlePost);
