import { generateJSON } from "@/lib/claude";
import { logger } from "@/lib/logger";
import { normalizeUnit } from "@/lib/unit-normalizer";
import { RECEIPT_PARSER_SYSTEM_PROMPT } from "@/prompts/receipt-parser";
import type { ReceiptLineItem } from "@/lib/textract";
import type { ParsedItem } from "./sales-parser";

type ProductRecord = {
  id: string;
  name: string;
  defaultUnit: string | null;
};

type LLMReceiptItem = {
  product: string;
  quantity: number | null;
  unit: string | null;
  matched?: boolean;
  status?: "ok" | "ambiguous";
  clarification?: string;
};

/**
 * LLM receipt parser — receives structured Textract line items rather than
 * raw OCR text. The LLM only resolves descriptions to known products and
 * fills in unit hints; the structural work (finding line items, extracting
 * quantities, filtering noise) is already done by AnalyzeExpense.
 *
 * Returns null when the LLM is unavailable so the caller can decide whether
 * to fall back to the structured rule-based path or fail clearly. See ADR-019.
 */
export async function llmParseReceiptLineItems(
  lineItems: ReceiptLineItem[],
  products: ProductRecord[]
): Promise<{
  parsed: ParsedItem[];
  unmatched: string[];
  parseMethod: "llm";
} | null> {
  if (lineItems.length === 0) {
    return { parsed: [], unmatched: [], parseMethod: "llm" };
  }

  const productList = products
    .map((p) => `${p.name}${p.defaultUnit ? ` (${p.defaultUnit})` : ""}`)
    .join(", ");

  const lineItemPayload = lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
  }));

  const userMessage = `Known products: ${productList || "none yet"}

Receipt line items:
${JSON.stringify(lineItemPayload, null, 2)}`;

  const result = await generateJSON<LLMReceiptItem[]>(
    RECEIPT_PARSER_SYSTEM_PROMPT,
    userMessage,
    1024
  );

  if (!result || !Array.isArray(result)) return null;

  const parsed: ParsedItem[] = [];
  const productMap = new Map(products.map((p) => [p.name.toLowerCase(), p]));

  for (const item of result) {
    if (!item.product) continue;

    const matchKey = item.product.toLowerCase();
    const matched = productMap.get(matchKey);
    const singularKey = matchKey.replace(/s$/, "");
    const singularMatch = !matched ? productMap.get(singularKey) : null;
    const product = matched || singularMatch;

    const rawUnit = item.unit ?? product?.defaultUnit ?? null;
    const normalizedUnit = normalizeUnit(rawUnit);

    parsed.push({
      rawText: `${item.quantity ?? 1}${item.unit ? item.unit : ""} ${item.product}`,
      product: product?.name ?? item.product,
      productId: product?.id ?? null,
      quantity: item.quantity ?? 1,
      unit: normalizedUnit,
      matched: product !== undefined,
      status: item.status || "ok",
      clarification: item.status === "ambiguous" ? item.clarification : undefined,
    });
  }

  const unmatched = parsed.filter((p) => !p.matched).map((p) => p.product);

  logger.info("llm-receipt-parser", "LLM receipt parse complete", {
    inputLineItems: lineItems.length,
    itemCount: parsed.length,
    unmatchedCount: unmatched.length,
  });

  return { parsed, unmatched, parseMethod: "llm" };
}
