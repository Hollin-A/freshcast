import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, errorResponse, getBusinessId, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { normalizeUnit } from "@/lib/unit-normalizer";
import { sanitizeText } from "@/lib/sanitize";
import { getProductDailyHistory } from "@/services/analytics";
import { productInputSchema, updateProductSchema } from "@/schemas";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { businessId, timezone } = ctx;
    const active = request.nextUrl.searchParams.get("active") !== "false";

    const products = await prisma.product.findMany({
      where: { businessId, ...(active ? { isActive: true } : {}) },
      select: { id: true, name: true, defaultUnit: true, isActive: true },
      orderBy: { name: "asc" },
    });

    // Fetch per-product analytics (7-day avg + trend)
    const productHistory = await getProductDailyHistory(businessId, timezone, 7);
    const analyticsMap = new Map(productHistory.map((h) => [h.productId, h]));

    const enriched = products.map((p) => {
      const analytics = analyticsMap.get(p.id);
      return {
        ...p,
        avgPerDay: analytics?.avgPerDay ?? null,
        trend: analytics?.trend ?? null,
      };
    });

    return ok(enriched);
  } catch (err) {
    logger.error("products", "GET /api/products failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

export async function POST(request: Request) {
  try {
    const businessId = await getBusinessId();
    if (!businessId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const body = await request.json();
    const result = productInputSchema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", 400, {
        fields: result.error.flatten().fieldErrors,
      });
    }

    const { name: rawName, defaultUnit } = result.data;
    const name = sanitizeText(rawName);

    const existing = await prisma.product.findUnique({
      where: { businessId_name: { businessId, name } },
    });
    if (existing) {
      return errorResponse("CONFLICT", "Product with this name already exists", 409);
    }

    const product = await prisma.product.create({
      data: { name, defaultUnit: normalizeUnit(defaultUnit) ?? null, businessId },
      select: { id: true, name: true, defaultUnit: true, isActive: true },
    });

    logger.info("products", "Product created", { productId: product.id, name });
    return ok(product, { status: 201 });
  } catch (err) {
    logger.error("products", "POST /api/products failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const businessId = await getBusinessId();
    if (!businessId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const body = await request.json();
    const result = updateProductSchema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", 400, {
        fields: result.error.flatten().fieldErrors,
      });
    }

    const { id, name, defaultUnit, isActive } = result.data;

    // Verify product belongs to this business
    const existing = await prisma.product.findFirst({
      where: { id, businessId },
    });
    if (!existing) {
      return errorResponse("NOT_FOUND", "Product not found", 404);
    }

    // Check for duplicate name if renaming
    if (name && name !== existing.name) {
      const duplicate = await prisma.product.findUnique({
        where: { businessId_name: { businessId, name } },
      });
      if (duplicate) {
        return errorResponse("CONFLICT", "Product with this name already exists", 409);
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(defaultUnit !== undefined && { defaultUnit: normalizeUnit(defaultUnit) }),
        ...(isActive !== undefined && { isActive }),
      },
      select: { id: true, name: true, defaultUnit: true, isActive: true },
    });

    return ok(product);
  } catch (err) {
    logger.error("products", "PATCH /api/products failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
