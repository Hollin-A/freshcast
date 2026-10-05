import { prisma } from "@/lib/prisma";
import { ok, errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { llmParseReceiptLineItems } from "@/services/llm-receipt-parser";
import { ruleBasedReceiptParse } from "@/services/rule-based-receipt-parser";
import { extractReceiptFromS3 } from "@/lib/textract";
import { getReceiptsBucket, isReceiptUploadEnabled } from "@/lib/s3";
import { rateLimit } from "@/lib/rate-limit";
import { parseReceiptSchema } from "@/schemas";
import { withRequestLogging } from "@/lib/request-logging";

/**
 * Whether to use the structured rule-based fallback when the LLM is
 * unavailable. Off by default per ADR-019 — the LLM path is the supported
 * one and the route returns 503 with a clear error message when it fails.
 *
 * Set `RECEIPT_FALLBACK=structured` in the deployment env to opt in. This
 * is a single-knob feature flag pending the broader feature-flag system
 * planned in Phase 32.1.3.
 */
function isStructuredFallbackEnabled(): boolean {
  return process.env.RECEIPT_FALLBACK === "structured";
}

async function handlePost(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    if (!isReceiptUploadEnabled()) {
      return errorResponse(
        "FEATURE_DISABLED",
        "Receipt reading is currently unavailable. Type your sales or use the product form instead.",
        503
      );
    }

    // Each parse calls Textract and Claude, so cap it per business.
    const { success: rateLimitOk } = rateLimit(`receipt-parse:${ctx.businessId}`, 20, 60 * 60 * 1000);
    if (!rateLimitOk) {
      return errorResponse("RATE_LIMITED", "Too many receipts processed. Please try again later.", 429);
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

    let extraction;
    try {
      extraction = await extractReceiptFromS3(bucket, key);
    } catch (err) {
      logger.warn("receipts", "Textract AnalyzeExpense failed", { key, error: String(err) });
      return errorResponse(
        "SERVICE_UNAVAILABLE",
        "We couldn't read that receipt. Please try another photo or type your sales manually.",
        503
      );
    }

    const { lineItems, rawText } = extraction;

    if (lineItems.length === 0) {
      logger.warn("receipts", "AnalyzeExpense returned no line items", {
        key,
        rawTextLength: rawText.length,
      });
      return errorResponse(
        "SERVICE_UNAVAILABLE",
        "No readable line items were detected in the receipt image.",
        503
      );
    }

    const products = await prisma.product.findMany({
      where: { businessId: ctx.businessId, isActive: true },
      select: { id: true, name: true, defaultUnit: true },
    });

    const llmResult = await llmParseReceiptLineItems(lineItems, products);
    if (llmResult) {
      logger.info("receipts", "Receipt parsed", {
        key,
        parseMethod: "llm",
        lineItemCount: lineItems.length,
        itemCount: llmResult.parsed.length,
        unmatchedCount: llmResult.unmatched.length,
      });
      return ok({
        ...llmResult,
        source: "receipt",
        key,
        extractedText: rawText,
        lineItems,
      });
    }

    if (isStructuredFallbackEnabled()) {
      const ruleResult = ruleBasedReceiptParse(lineItems, products);
      logger.info("receipts", "Receipt parsed via structured rule-based fallback", {
        key,
        parseMethod: "rule-based-structured",
        lineItemCount: lineItems.length,
        itemCount: ruleResult.parsed.length,
        unmatchedCount: ruleResult.unmatched.length,
      });
      return ok({
        ...ruleResult,
        parseMethod: "rule-based-structured" as const,
        source: "receipt",
        key,
        extractedText: rawText,
        lineItems,
      });
    }

    logger.warn("receipts", "Receipt parse hit error path", {
      key,
      parseMethod: "error",
      lineItemCount: lineItems.length,
    });
    return errorResponse(
      "SERVICE_UNAVAILABLE",
      "Receipt reading needs our AI service, which is temporarily unavailable. Please try again in a few minutes, or type your sale on the Log tab — that still works.",
      503
    );
  } catch (err) {
    logger.error("receipts", "POST /api/receipts/parse failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

export const POST = withRequestLogging(handlePost);
