import { NextResponse } from "next/server";
import { errorResponse, getBusinessId } from "@/lib/api-helpers";
import { getTodaySummary, getWeekSummary, getTopProducts } from "@/services/analytics";
import { predictNextDay } from "@/services/prediction-engine";
import { getOrGenerateInsights } from "@/services/insight-generator";

export async function GET() {
  try {
    const businessId = await getBusinessId();
    if (!businessId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const [todaySummary, weekSummary, topProducts, predictions, insightsResult] =
      await Promise.all([
        getTodaySummary(businessId),
        getWeekSummary(businessId),
        getTopProducts(businessId),
        predictNextDay(businessId).catch(() => null),
        getOrGenerateInsights(businessId).catch(() => ({
          insights: [],
          generatedAt: new Date().toISOString(),
        })),
      ]);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return NextResponse.json({
      todaySummary,
      weekSummary,
      topProducts,
      forecast: predictions
        ? {
            forecastDate: tomorrow.toISOString().split("T")[0],
            predictions: predictions.predictions,
            dataPoints: predictions.dataPoints,
          }
        : null,
      insights: insightsResult.insights,
      lastUpdated: insightsResult.generatedAt,
    });
  } catch {
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
