import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, getBusinessId } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

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
    const businessId = await getBusinessId();
    if (!businessId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const body = await request.json();
    const result = createSalesSchema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", 400, {
        fields: result.error.flatten().fieldErrors,
      });
    }

    const { date, inputMethod, rawInput, items } = result.data;
    const entryDate = new Date(date);

    // Check date is not in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (entryDate > today) {
      return errorResponse("VALIDATION_ERROR", "Date cannot be in the future", 400);
    }

    // Check if entry already exists for this date — if so, merge items
    const existing = await prisma.salesEntry.findUnique({
      where: { businessId_date: { businessId, date: entryDate } },
    });

    if (existing) {
      // Delete old items and replace
      await prisma.salesItem.deleteMany({ where: { salesEntryId: existing.id } });
      const updated = await prisma.salesEntry.update({
        where: { id: existing.id },
        data: {
          inputMethod,
          rawInput: rawInput ?? null,
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
      return NextResponse.json(updated);
    }

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

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    logger.error("sales", "POST /api/sales failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const businessId = await getBusinessId();
    if (!businessId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

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
        orderBy: { date: "desc" },
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
