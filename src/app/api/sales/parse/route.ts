import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { parseSalesInput } from "@/services/sales-parser";
import { llmParseSalesInput } from "@/services/llm-sales-parser";

const parseSchema = z.object({
  text: z.string().min(1).max(1000),
});

export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { businessId } = ctx;

    // Rate limit: 30 parses per user per hour
    const { success: rateLimitOk } = rateLimit(`parse:${businessId}`, 30, 60 * 60 * 1000);
    if (!rateLimitOk) {
      return errorResponse("RATE_LIMITED", "Too many parse requests. Try again in a few minutes.", 429);
    }

    const body = await request.json();
    const result = parseSchema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", 400);
    }

    const products = await prisma.product.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, defaultUnit: true },
    });

    // Try LLM parser first, fall back to rule-based
    const llmResult = await llmParseSalesInput(result.data.text, products);

    if (llmResult) {
      logger.info("sales-parse", "Used LLM parser", { itemCount: llmResult.parsed.length });
      return NextResponse.json(llmResult);
    }

    // Fallback to rule-based parser
    const parsed = parseSalesInput(result.data.text, products);
    logger.info("sales-parse", "Used rule-based parser", { itemCount: parsed.parsed.length });

    return NextResponse.json({ ...parsed, parseMethod: "rule-based" });
  } catch (err) {
    logger.error("sales-parse", "POST /api/sales/parse failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
