import { generateJSON } from "@/lib/claude";
import { logger } from "@/lib/logger";
import { normalizeUnit } from "@/lib/unit-normalizer";
import { PARSER_SYSTEM_PROMPT } from "@/prompts/parser";
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

export async function llmParseSalesInput(
  text: string,
  products: ProductRecord[]
): Promise<{ parsed: ParsedItem[]; unmatched: string[]; parseMethod: "llm" } | null> {
  const productList = products.map((p) => `${p.name}${p.defaultUnit ? ` (${p.defaultUnit})` : ""}`).join(", ");

  const userMessage = `Known products: ${productList || "none yet"}

Sales input: "${text}"`;

  const result = await generateJSON<LLMParsedItem[]>(
    PARSER_SYSTEM_PROMPT,
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
