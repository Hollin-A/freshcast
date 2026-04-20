import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const userId = session.user.id;

    // Check if this is a demo account
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isDemo: true },
    });
    if (user?.isDemo) {
      return errorResponse("FORBIDDEN", "Demo account cannot be deleted", 403);
    }

    // Cascade delete: business → products, sales, insights, forecasts
    const business = await prisma.business.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (business) {
      // Delete in order respecting foreign keys
      await prisma.$transaction(async (tx) => {
        const entries = await tx.salesEntry.findMany({
          where: { businessId: business.id },
          select: { id: true },
        });
        if (entries.length > 0) {
          await tx.salesItem.deleteMany({
            where: { salesEntryId: { in: entries.map((e) => e.id) } },
          });
        }
        await tx.salesEntry.deleteMany({ where: { businessId: business.id } });
        await tx.dailyInsight.deleteMany({ where: { businessId: business.id } });
        await tx.demandForecast.deleteMany({ where: { businessId: business.id } });
        await tx.product.deleteMany({ where: { businessId: business.id } });
        await tx.business.delete({ where: { id: business.id } });
      });
    }

    // Delete auth-related data
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    logger.info("account", "Account deleted", { userId });

    return NextResponse.json({ message: "Account deleted successfully" });
  } catch (err) {
    logger.error("account", "DELETE /api/account failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
