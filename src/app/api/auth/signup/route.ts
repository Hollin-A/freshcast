import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email({ error: "Please enter a valid email" }),
  password: z
    .string()
    .min(8, { error: "Password must be at least 8 characters" }),
});

export async function POST(request: Request) {
  try {
    // Rate limit: 10 signups per IP per hour
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { success } = rateLimit(`signup:${ip}`, 10, 60 * 60 * 1000);
    if (!success) {
      return errorResponse("RATE_LIMITED", "Too many requests. Please try again later.", 429);
    }

    const body = await request.json();
    const result = signupSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid input",
        400,
        { fields: result.error.flatten().fieldErrors }
      );
    }

    const { name, email, password } = result.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return errorResponse("CONFLICT", "Email already registered", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: { name, email, passwordHash },
    });

    logger.info("auth", "User signed up", { email });

    // Send verification email (non-blocking, don't fail signup if email fails)
    try {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.verificationToken.create({
        data: { identifier: `verify:${email}`, token, expires },
      });
      const verifyUrl = `${process.env.AUTH_URL || "http://localhost:3000"}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
      await sendEmail(
        email,
        "Welcome to Freshcast — Verify your email",
        `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #B5553A; font-size: 24px; margin-bottom: 8px;">Welcome to Freshcast</h2>
          <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">Thanks for signing up. Verify your email to get the most out of Freshcast.</p>
          <a href="${verifyUrl}" style="display: inline-block; background-color: #B5553A; color: #FFF8EC; text-decoration: none; padding: 12px 32px; border-radius: 999px; font-size: 16px; font-weight: 500;">Verify Email</a>
          <p style="color: #999; font-size: 13px; margin-top: 32px;">This link expires in 24 hours.</p>
        </div>`
      );
    } catch (emailErr) {
      logger.warn("auth", "Failed to send verification email", emailErr);
    }

    return NextResponse.json(
      { message: "Account created successfully" },
      { status: 201 }
    );
  } catch (err) {
    logger.error("auth", "POST /api/auth/signup failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
