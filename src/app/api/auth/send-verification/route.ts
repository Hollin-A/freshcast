import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

function buildVerificationEmail(verifyUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #B5553A; font-size: 24px; margin-bottom: 8px;">Welcome to Freshcast</h2>
      <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
        Thanks for signing up. Please verify your email address by clicking the button below.
      </p>
      <a href="${verifyUrl}" style="display: inline-block; background-color: #B5553A; color: #FFF8EC; text-decoration: none; padding: 12px 32px; border-radius: 999px; font-size: 16px; font-weight: 500;">
        Verify Email
      </a>
      <p style="color: #999; font-size: 13px; line-height: 1.5; margin-top: 32px;">
        This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.
      </p>
      <p style="color: #ccc; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 16px;">
        Freshcast — Sales tracking for small businesses
      </p>
    </div>
  `;
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true, email: true },
    });

    if (user?.emailVerified) {
      return NextResponse.json({ message: "Email already verified" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Clean up old verification tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: `verify:${session.user.email}` },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: `verify:${session.user.email}`,
        token,
        expires,
      },
    });

    const verifyUrl = `${env.AUTH_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(session.user.email)}`;

    const sent = await sendEmail(
      session.user.email,
      "Verify your Freshcast email",
      buildVerificationEmail(verifyUrl)
    );

    if (!sent) {
      logger.warn("auth", "Verification email delivery failed", { email: session.user.email });
    }

    logger.info("auth", "Verification email sent", { email: session.user.email });
    return NextResponse.json({ message: "Verification email sent" });
  } catch (err) {
    logger.error("auth", "POST /api/auth/send-verification failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
