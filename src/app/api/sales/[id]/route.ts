import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, errorResponse, getBusinessId, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { getLocalDateStr } from "@/lib/dates";
import { updateSalesItemsSchema } from "@/schemas";
import { withRequestLogging } from "@/lib/request-logging";

async function handleGet(
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

    return ok(entry);
  } catch (err) {
    logger.error("sales", "GET /api/sales/[id] failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

async function handlePut(
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
    const result = updateSalesItemsSchema.safeParse(body);

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

    return ok(updated);
  } catch (err) {
    logger.error("sales", "PUT /api/sales/[id] failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

async function handleDelete(
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

    return ok({ message: "Entry deleted" });
  } catch (err) {
    logger.error("sales", "DELETE /api/sales/[id] failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

export const GET = withRequestLogging(handleGet);
export const PUT = withRequestLogging(handlePut);
export const DELETE = withRequestLogging(handleDelete);
