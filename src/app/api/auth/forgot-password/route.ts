import { NextResponse } from "next/server";
import * as z from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { sendEmail, buildPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.email({ error: "Please enter a valid email" }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid email", 400);
    }

    const { email } = result.data;

    // Rate limit: 3 reset requests per email per hour
    const { success } = rateLimit(`forgot:${email}`, 3, 60 * 60 * 1000);
    if (!success) {
      // Still return success message to prevent email enumeration
      return NextResponse.json({ message: "If an account exists, a reset link has been sent." });
    }

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      logger.info("auth", "Password reset requested for non-existent email", { email });
      return NextResponse.json({ message: "If an account exists, a reset link has been sent." });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    // Store token
    await prisma.verificationToken.create({
      data: { identifier: email, token, expires },
    });

    // Send password reset email
    const resetUrl = `${process.env.AUTH_URL || "http://localhost:3000"}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    const sent = await sendEmail(
      email,
      "Reset your BizSense password",
      buildPasswordResetEmail(resetUrl)
    );

    if (!sent) {
      // Log the link as fallback if email fails
      logger.warn("auth", "Email delivery failed, logging reset link", { email, resetUrl });
      console.log(`\n🔑 Password reset link for ${email}:\n${resetUrl}\n`);
    }

    return NextResponse.json({ message: "If an account exists, a reset link has been sent." });
  } catch (err) {
    logger.error("auth", "POST /api/auth/forgot-password failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
