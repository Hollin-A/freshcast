import { NextResponse } from "next/server";
import { errorResponse, getBusinessId } from "@/lib/api-helpers";
import { getTodaySummary, getWeekSummary, getTopProducts } from "@/services/analytics";

export async function GET() {
  try {
    const businessId = await getBusinessId();
    if (!businessId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const [todaySummary, weekSummary, topProducts] = await Promise.all([
      getTodaySummary(businessId),
      getWeekSummary(businessId),
      getTopProducts(businessId),
    ]);

    return NextResponse.json({
      todaySummary,
      weekSummary,
      topProducts,
      // Insights and predictions will be added in Phase 6
      insights: [],
      lastUpdated: new Date().toISOString(),
    });
  } catch {
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
