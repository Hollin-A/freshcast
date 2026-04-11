import { NextResponse } from "next/server";
import { errorResponse, getBusinessId } from "@/lib/api-helpers";
import { getOrGenerateInsights } from "@/services/insight-generator";

export async function GET() {
  try {
    const businessId = await getBusinessId();
    if (!businessId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const result = await getOrGenerateInsights(businessId);

    return NextResponse.json({
      date: new Date().toISOString().split("T")[0],
      ...result,
    });
  } catch {
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
