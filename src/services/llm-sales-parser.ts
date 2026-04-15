import { generateJSON } from "@/lib/claude";
import { logger } from "@/lib/logger";
import type { ParsedItem } from "./sales-parser";

type ProductRecord = {
  id: string;
  name: string;
  defaultUnit: string | null;
};

type LLMParsedItem = {
  product: string;
  quantity: number;
  unit: string | null;
};

const SYSTEM_PROMPT = `You are a sales data parser for a small retail business. Given a natural language description of sales and a list of known products, extract each item sold.

Return a JSON array where each item has:
- "product": the product name (match to known products when possible, use the exact known product name)
- "quantity": the numeric quantity sold (must be a positive number)
- "unit": the unit of measurement if mentioned (e.g., "kg", "g", "liters", "pieces"), or null if not specified

Rules:
- "a dozen" = 12
- "half kg" = 0.5 kg
- Match product names to the known products list when possible (case-insensitive, handle plurals)
- If a product is not in the known list, still include it with the name as written
- Ignore filler words like "sold", "I", "today", "about"
- If the same product appears multiple times, merge the quantities
- Only return the JSON array, no other text`;

export async function llmParseSalesInput(
  text: string,
  products: ProductRecord[]
): Promise<{ parsed: ParsedItem[]; unmatched: string[]; parseMethod: "llm" } | null> {
  const productList = products.map((p) => `${p.name}${p.defaultUnit ? ` (${p.defaultUnit})` : ""}`).join(", ");

  const userMessage = `Known products: ${productList || "none yet"}

Sales input: "${text}"`;

  const result = await generateJSON<LLMParsedItem[]>(
    SYSTEM_PROMPT,
    userMessage,
    512
  );

  if (!result || !Array.isArray(result)) return null;

  // Map LLM output to ParsedItem format
  const parsed: ParsedItem[] = [];
  const productMap = new Map(products.map((p) => [p.name.toLowerCase(), p]));

  for (const item of result) {
    if (!item.product || !item.quantity || item.quantity <= 0) continue;

    // Try to match to known product
    const matchKey = item.product.toLowerCase();
    const matched = productMap.get(matchKey);

    // Also try without trailing 's' for plural matching
    const singularKey = matchKey.replace(/s$/, "");
    const singularMatch = !matched ? productMap.get(singularKey) : null;

    const product = matched || singularMatch;

    parsed.push({
      rawText: `${item.quantity}${item.unit ? item.unit : ""} ${item.product}`,
      product: product?.name ?? item.product,
      productId: product?.id ?? null,
      quantity: item.quantity,
      unit: item.unit ?? product?.defaultUnit ?? null,
      matched: product !== undefined,
    });
  }

  const unmatched = parsed.filter((p) => !p.matched).map((p) => p.product);

  logger.info("llm-parser", "LLM parse complete", {
    itemCount: parsed.length,
    unmatchedCount: unmatched.length,
  });

  return { parsed, unmatched, parseMethod: "llm" };
}
