import { NextRequest, NextResponse } from "next/server";
import { errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { predictNextDay, predictNextWeek } from "@/services/prediction-engine";
import { getLocalDateStr, toUTCDate } from "@/lib/dates";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { businessId, timezone } = ctx;
    const horizon = request.nextUrl.searchParams.get("horizon") || "day";

    if (horizon === "day") {
      const result = await predictNextDay(businessId, timezone);
      if (!result) {
        return errorResponse(
          "INSUFFICIENT_DATA",
          "Log at least 5 days of sales to see predictions",
          422
        );
      }

      const todayStr = getLocalDateStr(timezone);
      const tomorrowDate = toUTCDate(todayStr);
      tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);

      return NextResponse.json({
        forecastDate: tomorrowDate.toISOString().split("T")[0],
        predictions: result.predictions,
        dataPoints: result.dataPoints,
        generatedAt: new Date().toISOString(),
      });
    }

    if (horizon === "week") {
      const result = await predictNextWeek(businessId, timezone);
      if (!result) {
        return errorResponse(
          "INSUFFICIENT_DATA",
          "Log at least 5 days of sales to see predictions",
          422
        );
      }

      const todayStr = getLocalDateStr(timezone);
      const weekStart = toUTCDate(todayStr);
      weekStart.setUTCDate(weekStart.getUTCDate() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

      return NextResponse.json({
        weekStart: weekStart.toISOString().split("T")[0],
        weekEnd: weekEnd.toISOString().split("T")[0],
        predictions: result,
        generatedAt: new Date().toISOString(),
      });
    }

    return errorResponse("VALIDATION_ERROR", "Invalid horizon. Use 'day' or 'week'", 400);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
