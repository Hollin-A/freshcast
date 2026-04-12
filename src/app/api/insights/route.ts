import { NextResponse } from "next/server";
import { errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { getOrGenerateInsights } from "@/services/insight-generator";
import { getLocalDateStr } from "@/lib/dates";

export async function GET() {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const result = await getOrGenerateInsights(ctx.businessId, ctx.timezone);

    return NextResponse.json({
      date: getLocalDateStr(ctx.timezone),
      ...result,
    });
  } catch (err) {
    logger.error("insights", "GET /api/insights failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
