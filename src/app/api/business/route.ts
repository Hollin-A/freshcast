import { NextResponse } from "next/server";
import * as z from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { BUSINESS_TYPES } from "@/lib/constants";

const createBusinessSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(BUSINESS_TYPES),
  locale: z.string().min(2).max(10).default("en"),
  timezone: z.string().min(1).max(50).default("UTC"),
  products: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        defaultUnit: z.string().max(20).optional(),
      })
    )
    .min(1)
    .max(10),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const existing = await prisma.business.findUnique({
      where: { userId: session.user.id },
    });
    if (existing) {
      return errorResponse("CONFLICT", "Business already exists for this user", 409);
    }

    const body = await request.json();
    const result = createBusinessSchema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", 400, {
        fields: result.error.flatten().fieldErrors,
      });
    }

    const { name, type, locale, timezone, products } = result.data;

    // Validate timezone is a real IANA identifier
    try {
      Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      return errorResponse("VALIDATION_ERROR", "Invalid timezone", 400);
    }

    logger.info("business", "Creating business", { name, type, timezone, productCount: products.length });

    const business = await prisma.business.create({
      data: {
        name,
        type,
        locale,
        timezone,
        onboarded: true,
        userId: session.user.id,
        products: {
          create: products.map((p) => ({
            name: p.name,
            defaultUnit: p.defaultUnit ?? null,
          })),
        },
      },
      include: {
        products: {
          select: { id: true, name: true, defaultUnit: true },
        },
      },
    });

    logger.info("business", "Business created", { businessId: business.id });
    return NextResponse.json(business, { status: 201 });
  } catch (err) {
    logger.error("business", "POST /api/business failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const business = await prisma.business.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        type: true,
        locale: true,
        onboarded: true,
        createdAt: true,
      },
    });

    if (!business) {
      return errorResponse("NOT_FOUND", "No business found", 404);
    }

    return NextResponse.json(business);
  } catch (err) {
    logger.error("business", "GET /api/business failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
