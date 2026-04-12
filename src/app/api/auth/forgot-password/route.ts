import { NextResponse } from "next/server";
import * as z from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

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

    // In MVP, log the reset link to console
    // TODO: Replace with email service (e.g., Resend, SendGrid)
    const resetUrl = `${process.env.AUTH_URL || "http://localhost:3000"}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    logger.info("auth", "Password reset link generated", { email, resetUrl });
    console.log(`\n🔑 Password reset link for ${email}:\n${resetUrl}\n`);

    return NextResponse.json({ message: "If an account exists, a reset link has been sent." });
  } catch (err) {
    logger.error("auth", "POST /api/auth/forgot-password failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
