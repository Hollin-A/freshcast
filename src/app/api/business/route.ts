import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, errorResponse } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { normalizeUnit } from "@/lib/unit-normalizer";
import { sanitizeText } from "@/lib/sanitize";
import { createBusinessSchema, updateBusinessSchema } from "@/schemas";

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
        name: sanitizeText(name),
        type,
        locale,
        timezone,
        onboarded: true,
        userId: session.user.id,
        products: {
          create: products.map((p) => ({
            name: sanitizeText(p.name),
            defaultUnit: normalizeUnit(p.defaultUnit) ?? null,
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
    return ok(business, { status: 201 });
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

    return ok(business);
  } catch (err) {
    logger.error("business", "GET /api/business failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const business = await prisma.business.findUnique({
      where: { userId: session.user.id },
    });
    if (!business) {
      return errorResponse("NOT_FOUND", "No business found", 404);
    }

    const body = await request.json();
    const result = updateBusinessSchema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", 400, {
        fields: result.error.flatten().fieldErrors,
      });
    }

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: result.data,
      select: { id: true, weeklyEmailEnabled: true },
    });

    return ok(updated);
  } catch (err) {
    logger.error("business", "PATCH /api/business failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
