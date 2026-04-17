import { generateJSON } from "@/lib/claude";
import { logger } from "@/lib/logger";
import { normalizeUnit } from "@/lib/unit-normalizer";
import type { ParsedItem } from "./sales-parser";

type ProductRecord = {
  id: string;
  name: string;
  defaultUnit: string | null;
};

type LLMParsedItem = {
  product: string;
  quantity: number | null;
  unit: string | null;
  status: "ok" | "ambiguous";
  clarification?: string;
};

const SYSTEM_PROMPT = `You are a sales data parser for a small retail business. Given a natural language description of sales and a list of known products, extract each item sold.

Return a JSON array where each item has:
- "product": the product name (match to known products when possible, use the exact known product name)
- "quantity": the numeric quantity sold (must be a positive number), or null if the quantity is unclear
- "unit": the unit of measurement using ONLY these values: "kg", "g", "lbs", "liters", "ml", "gallons", "pieces", "dozen", "units", "bottles", "packs", "bunches", "loaves", "cans", "boxes", "bags", "trays", "cartons" — or null if not specified
- "status": "ok" if the quantity is clear, "ambiguous" if the user used vague words like "few", "some", "a bit", "lots", "many", "several"
- "clarification": only if status is "ambiguous", a short message like "You said 'few' — how many exactly?"

Rules:
- "a dozen" = 12, quantity is clear (status: "ok")
- "half kg" = 0.5 kg
- Match product names to the known products list when possible (case-insensitive, handle plurals)
- If a product is not in the known list, still include it with the name as written
- Ignore filler words like "sold", "I", "today", "about", "around", "approximately" (these don't make it ambiguous)
- Words that DO make it ambiguous: "few", "some", "a bit", "lots", "many", "several", "a couple"
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

  const parsed: ParsedItem[] = [];
  const productMap = new Map(products.map((p) => [p.name.toLowerCase(), p]));

  for (const item of result) {
    if (!item.product) continue;

    const matchKey = item.product.toLowerCase();
    const matched = productMap.get(matchKey);
    const singularKey = matchKey.replace(/s$/, "");
    const singularMatch = !matched ? productMap.get(singularKey) : null;
    const product = matched || singularMatch;

    // Normalize the unit
    const rawUnit = item.unit ?? product?.defaultUnit ?? null;
    const normalizedUnit = normalizeUnit(rawUnit);

    parsed.push({
      rawText: `${item.quantity ?? "?"}${item.unit ? item.unit : ""} ${item.product}`,
      product: product?.name ?? item.product,
      productId: product?.id ?? null,
      quantity: item.quantity ?? 0,
      unit: normalizedUnit,
      matched: product !== undefined,
      status: item.status || "ok",
      clarification: item.status === "ambiguous" ? item.clarification : undefined,
    });
  }

  const unmatched = parsed.filter((p) => !p.matched).map((p) => p.product);

  logger.info("llm-parser", "LLM parse complete", {
    itemCount: parsed.length,
    unmatchedCount: unmatched.length,
    ambiguousCount: parsed.filter((p) => p.status === "ambiguous").length,
  });

  return { parsed, unmatched, parseMethod: "llm" };
}
