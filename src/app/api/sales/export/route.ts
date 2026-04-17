import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, getBusinessId } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const businessId = await getBusinessId();
    if (!businessId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const params = request.nextUrl.searchParams;
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const from = params.get("from") ? new Date(params.get("from")!) : defaultFrom;
    const to = params.get("to") ? new Date(params.get("to")!) : now;

    const entries = await prisma.salesEntry.findMany({
      where: { businessId, date: { gte: from, lte: to } },
      include: {
        items: {
          include: { product: { select: { name: true } } },
        },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    // Build CSV
    const rows: string[] = ["Date,Time,Product,Quantity,Unit,Input Method"];

    for (const entry of entries) {
      const date = new Date(entry.date).toISOString().split("T")[0];
      const time = new Date(entry.createdAt).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const method = entry.inputMethod === "NATURAL_LANGUAGE" ? "NL" : "Manual";

      for (const item of entry.items) {
        const productName = item.product.name.includes(",")
          ? `"${item.product.name}"`
          : item.product.name;
        rows.push(`${date},${time},${productName},${item.quantity},${item.unit || ""},${method}`);
      }
    }

    const csv = rows.join("\n");

    logger.info("sales-export", "CSV exported", { businessId, entries: entries.length });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="freshcast-sales-${from.toISOString().split("T")[0]}-to-${to.toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (err) {
    logger.error("sales-export", "GET /api/sales/export failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
