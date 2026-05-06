import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { llmParseSalesInput } from "@/services/llm-sales-parser";
import { extractReceiptTextFromS3 } from "@/lib/textract";
import { getReceiptsBucket } from "@/lib/s3";

const parseReceiptSchema = z.object({
  key: z.string().min(1).max(1024),
});

export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const bucket = getReceiptsBucket();
    if (!bucket) {
      return errorResponse("SERVICE_UNAVAILABLE", "Receipt parsing is not configured", 503);
    }

    const body = await request.json();
    const result = parseReceiptSchema.safeParse(body);
    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid parse request", 400);
    }

    const { key } = result.data;
    const expectedPrefix = `receipts/${ctx.businessId}/`;
    if (!key.startsWith(expectedPrefix)) {
      return errorResponse("FORBIDDEN", "You do not have access to this receipt", 403);
    }

    let extractedText = "";
    try {
      extractedText = await extractReceiptTextFromS3(bucket, key);
    } catch (err) {
      logger.warn("receipts", "Textract failed", { key, error: String(err) });
      return errorResponse(
        "SERVICE_UNAVAILABLE",
        "We couldn't read that receipt. Please try another photo or type your sales manually.",
        503
      );
    }

    if (!extractedText.trim()) {
      return errorResponse(
        "SERVICE_UNAVAILABLE",
        "No readable text was detected in the receipt image.",
        503
      );
    }

    const products = await prisma.product.findMany({
      where: { businessId: ctx.businessId, isActive: true },
      select: { id: true, name: true, defaultUnit: true },
    });

    const llmResult = await llmParseSalesInput(extractedText, products);
    if (!llmResult) {
      logger.warn("receipts", "Receipt parse hit error path", {
        key,
        parseMethod: "error",
        extractedTextLength: extractedText.length,
      });
      return errorResponse(
        "SERVICE_UNAVAILABLE",
        "Receipt reading needs our AI service, which is temporarily unavailable. Please try again in a few minutes, or type your sale on the Log tab — that still works.",
        503
      );
    }

    logger.info("receipts", "Receipt parsed", {
      key,
      parseMethod: "llm",
      itemCount: llmResult.parsed.length,
      unmatchedCount: llmResult.unmatched.length,
    });

    return NextResponse.json({
      ...llmResult,
      source: "receipt",
      key,
      extractedText,
    });
  } catch (err) {
    logger.error("receipts", "POST /api/receipts/parse failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
