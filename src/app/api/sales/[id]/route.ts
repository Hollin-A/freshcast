import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, getBusinessId, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { getLocalDateStr } from "@/lib/dates";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
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
  ctx: { params: Promise<{ id: string }> }
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

    // Only allow editing today's entry (using business timezone)
    const ctx2 = await getBusinessContext();
    const todayStr = getLocalDateStr(ctx2?.timezone ?? "UTC");
    const entryDateStr = new Date(entry.date).toISOString().split("T")[0];
    if (entryDateStr !== todayStr) {
      return errorResponse("VALIDATION_ERROR", "Can only edit today's entry", 400);
    }

    const body = await request.json();
    const result = updateItemsSchema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", 400, {
        fields: result.error.flatten().fieldErrors,
      });
    }

    // Atomic: delete old items and create new ones in a single transaction
    const updated = await prisma.$transaction(async (tx) => {
      await tx.salesItem.deleteMany({ where: { salesEntryId: id } });
      return tx.salesEntry.update({
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
    });

    return NextResponse.json(updated);
  } catch (err) {
    logger.error("sales", "PUT /api/sales/[id] failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
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

    await prisma.salesEntry.delete({ where: { id } });

    logger.info("sales", "Sales entry deleted", { entryId: id });

    return NextResponse.json({ message: "Entry deleted" });
  } catch (err) {
    logger.error("sales", "DELETE /api/sales/[id] failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
