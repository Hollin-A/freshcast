import { NextRequest, NextResponse } from "next/server";
import { errorResponse, getBusinessId } from "@/lib/api-helpers";
import { predictNextDay, predictNextWeek } from "@/services/prediction-engine";

export async function GET(request: NextRequest) {
  try {
    const businessId = await getBusinessId();
    if (!businessId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const horizon = request.nextUrl.searchParams.get("horizon") || "day";

    if (horizon === "day") {
      const result = await predictNextDay(businessId);
      if (!result) {
        return errorResponse(
          "INSUFFICIENT_DATA",
          "Log at least 5 days of sales to see predictions",
          422
        );
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return NextResponse.json({
        forecastDate: tomorrow.toISOString().split("T")[0],
        predictions: result.predictions,
        dataPoints: result.dataPoints,
        generatedAt: new Date().toISOString(),
      });
    }

    if (horizon === "week") {
      const result = await predictNextWeek(businessId);
      if (!result) {
        return errorResponse(
          "INSUFFICIENT_DATA",
          "Log at least 5 days of sales to see predictions",
          422
        );
      }

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() + 1);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);

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
