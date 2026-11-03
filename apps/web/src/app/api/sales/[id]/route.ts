import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, errorResponse, getBusinessId } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
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
export const DELETE = withRequestLogging(handleDelete);
