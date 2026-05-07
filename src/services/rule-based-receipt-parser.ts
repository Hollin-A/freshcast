import { matchProduct } from "./product-matcher";
import { normalizeUnit } from "@/lib/unit-normalizer";
import type { ReceiptLineItem } from "@/lib/textract";
import type { ParsedItem } from "./sales-parser";

type ProductRecord = {
  id: string;
  name: string;
  defaultUnit: string | null;
};

/**
 * Receipt-line noise patterns that should never be treated as sales items
 * even if AnalyzeExpense surfaces them inside LineItems. Most receipts put
 * these in SummaryFields, but some retailers leak them into the line table.
 */
const NOISE_DESCRIPTION = new RegExp(
  "^(total|subtotal|sub-total|gst|tax|cash|change|tendered|received|round(ing)?|discount|eftpos|card|payment|balance|amount\\s*due|due|fee|surcharge|tip|gratuity)\\s*$",
  "i"
);

/**
 * Extract a unit hint from a description suffix like "500G", "12PK", "2L".
 * Returns the canonical unit token (lowercase) or null.
 */
function inferUnitFromDescription(description: string): string | null {
  const trimmed = description.trim();
  const match = trimmed.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pk|pck|pack|ct|tray|tin|can|box)\b/i);
  if (!match) return null;
  const raw = match[2].toLowerCase();
  if (raw === "l") return "liters";
  if (raw === "pk" || raw === "pck" || raw === "pack") return "packs";
  if (raw === "ct") return "cartons";
  if (raw === "tin" || raw === "can") return "cans";
  return raw;
}

/**
 * Receipt-specific rule-based parser. Operates on AWS-structured line items,
 * NOT raw OCR text — receipts are too noisy for the chat-style parser.
 *
 * Per line item: filter obvious receipt noise, run the existing fuzzy
 * product matcher against the description, and use the AWS-provided
 * quantity verbatim (defaulting to 1 if AWS did not detect one).
 *
 * This path is feature-flagged off by default in the receipts route
 * (see ADR-019). It exists so that when the LLM is unavailable, an
 * operator can opt in to a structured fallback that is meaningful for the
 * first time on receipts (because the input shape is now appropriate).
 */
export function ruleBasedReceiptParse(
  lineItems: ReceiptLineItem[],
  products: ProductRecord[]
): { parsed: ParsedItem[]; unmatched: string[] } {
  const parsed: ParsedItem[] = [];

  for (const item of lineItems) {
    const desc = item.description.trim();
    if (!desc) continue;
    if (NOISE_DESCRIPTION.test(desc)) continue;

    const match = matchProduct(desc, products);
    const matchedProduct = match
      ? products.find((p) => p.id === match.productId) ?? null
      : null;

    const inferredUnit = item.unit ?? inferUnitFromDescription(desc);
    const fallbackUnit = matchedProduct?.defaultUnit ?? null;
    const resolvedUnit = inferredUnit ?? fallbackUnit;

    const quantity = item.quantity ?? 1;
    if (quantity <= 0) continue;

    parsed.push({
      rawText: item.rawRow ?? desc,
      product: match?.productName ?? desc,
      productId: match?.productId ?? null,
      quantity,
      unit: normalizeUnit(resolvedUnit),
      matched: match !== null,
      status: "ok",
    });
  }

  const unmatched = parsed.filter((p) => !p.matched).map((p) => p.product);
  return { parsed, unmatched };
}
