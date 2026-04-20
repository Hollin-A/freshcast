import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { getLocalDateStr } from "@/lib/dates";

const createSalesSchema = z.object({
  date: z.string().date(),
  inputMethod: z.enum(["NATURAL_LANGUAGE", "MANUAL"]),
  rawInput: z.string().max(1000).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive(),
        unit: z.string().optional().nullable(),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { businessId, timezone } = ctx;

    const body = await request.json();
    const result = createSalesSchema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", 400, {
        fields: result.error.flatten().fieldErrors,
      });
    }

    const { date, inputMethod, rawInput, items } = result.data;
    const entryDate = new Date(date + "T00:00:00Z");

    // Check date is not in the future (using business timezone)
    const todayStr = getLocalDateStr(timezone);
    if (date > todayStr) {
      return errorResponse("VALIDATION_ERROR", "Date cannot be in the future", 400);
    }

    // Verify all product IDs belong to this business
    const productIds = items.map((i) => i.productId);
    const ownedProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId },
      select: { id: true },
    });
    const ownedIds = new Set(ownedProducts.map((p) => p.id));
    const invalidIds = productIds.filter((id) => !ownedIds.has(id));
    if (invalidIds.length > 0) {
      return errorResponse("VALIDATION_ERROR", "One or more products do not belong to your business", 400);
    }

    logger.info("sales", "Creating sales entry", {
      date,
      inputMethod,
      itemCount: items.length,
    });

    const entry = await prisma.salesEntry.create({
      data: {
        date: entryDate,
        inputMethod,
        rawInput: rawInput ?? null,
        businessId,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit ?? null,
          })),
        },
      },
      include: {
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
    });

    logger.info("sales", "Sales entry created", { entryId: entry.id });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    logger.error("sales", "POST /api/sales failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { businessId } = ctx;
    const params = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(params.get("limit") || "20"), 100);
    const offset = parseInt(params.get("offset") || "0");

    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const from = params.get("from") ? new Date(params.get("from")!) : defaultFrom;
    const to = params.get("to") ? new Date(params.get("to")!) : now;

    const [entries, total] = await Promise.all([
      prisma.salesEntry.findMany({
        where: {
          businessId,
          date: { gte: from, lte: to },
        },
        include: {
          items: {
            include: { product: { select: { id: true, name: true } } },
          },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.salesEntry.count({
        where: {
          businessId,
          date: { gte: from, lte: to },
        },
      }),
    ]);

    return NextResponse.json({ entries, total, limit, offset });
  } catch (err) {
    logger.error("sales", "GET /api/sales failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
