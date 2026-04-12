import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, getBusinessId } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/sales/[id]">
) {
  try {
    const businessId = await getBusinessId();
    if (!businessId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { id } = await ctx.params;

    const entry = await prisma.salesEntry.findFirst({
      where: { id, businessId },
      include: {
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
    });

    if (!entry) {
      return errorResponse("NOT_FOUND", "Sales entry not found", 404);
    }

    return NextResponse.json(entry);
  } catch (err) {
    logger.error("sales", "GET /api/sales/[id] failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

const updateItemsSchema = z.object({
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

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/sales/[id]">
) {
  try {
    const businessId = await getBusinessId();
    if (!businessId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { id } = await ctx.params;

    const entry = await prisma.salesEntry.findFirst({
      where: { id, businessId },
    });

    if (!entry) {
      return errorResponse("NOT_FOUND", "Sales entry not found", 404);
    }

    // Only allow editing today's entry
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = new Date(entry.date);
    entryDate.setHours(0, 0, 0, 0);
    if (entryDate.getTime() !== today.getTime()) {
      return errorResponse("VALIDATION_ERROR", "Can only edit today's entry", 400);
    }

    const body = await request.json();
    const result = updateItemsSchema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", 400, {
        fields: result.error.flatten().fieldErrors,
      });
    }

    // Replace all items
    await prisma.salesItem.deleteMany({ where: { salesEntryId: id } });

    const updated = await prisma.salesEntry.update({
      where: { id },
      data: {
        items: {
          create: result.data.items.map((item) => ({
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
  } catch (err) {
    logger.error("sales", "PUT /api/sales/[id] failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
