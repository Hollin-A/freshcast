import { matchProduct } from "./product-matcher";
import { KNOWN_UNITS } from "@/lib/constants";
import { normalizeUnit } from "@/lib/unit-normalizer";

type ProductRecord = {
  id: string;
  name: string;
  defaultUnit: string | null;
};

export type ParsedItem = {
  rawText: string;
  product: string;
  productId: string | null;
  quantity: number;
  unit: string | null;
  matched: boolean;
  status?: "ok" | "ambiguous";
  clarification?: string;
};

const FILLER_WORDS = /\b(i|sold|today|about|around|approximately|roughly|some|of)\b/gi;

// Unit pattern uses word boundaries to avoid matching inside words (e.g., "g" in "eggs")
// Single-char units (g, l) must be standalone words or glued to a number (handled separately)
const UNIT_PATTERN = new RegExp(
  `\\b(${KNOWN_UNITS.filter((u) => u.length > 1).join("|")})\\b`,
  "i"
);
// Single-char units only match at the start of the token (right after number extraction)
const SHORT_UNIT_PATTERN = /^(g|l)\b/i;

function parseToken(
  raw: string,
  products: ProductRecord[]
): ParsedItem | null {
  let token = raw.trim();
  if (!token) return null;

  // Handle "a dozen X" → 12
  let quantity: number | null = null;
  let unit: string | null = null;

  // "a dozen" or "dozen"
  if (/\ba?\s*dozen\b/i.test(token)) {
    quantity = 12;
    token = token.replace(/\ba?\s*dozen\b/i, "").trim();
  }

  // "half kg" → 0.5 kg
  if (/\bhalf\b/i.test(token)) {
    quantity = 0.5;
    token = token.replace(/\bhalf\b/i, "").trim();
  }

  // Extract number: "30kg" or "30 kg" or "30"
  if (quantity === null) {
    const numMatch = token.match(/(\d+\.?\d*)/);
    if (numMatch) {
      quantity = parseFloat(numMatch[1]);
      token = token.replace(numMatch[0], "").trim();
    }
  }

  if (quantity === null || quantity <= 0) return null;

  // Extract unit: try short units first (g, l — only at start of remaining token)
  // then multi-char units with word boundaries
  const shortUnitMatch = token.match(SHORT_UNIT_PATTERN);
  if (shortUnitMatch) {
    unit = shortUnitMatch[1].toLowerCase();
    if (unit === "l") unit = "liters";
    token = token.replace(SHORT_UNIT_PATTERN, "").trim();
  } else {
    const unitMatch = token.match(UNIT_PATTERN);
    if (unitMatch) {
      unit = unitMatch[1].toLowerCase();
      if (unit === "pcs") unit = "pieces";
      token = token.replace(UNIT_PATTERN, "").trim();
    }
  }

  // Remaining text is the product name
  let productName = token.replace(FILLER_WORDS, "").replace(/\s+/g, " ").trim();
  if (!productName) return null;

  // Capitalize first letter
  productName = productName.charAt(0).toUpperCase() + productName.slice(1);

  // Match against known products
  const match = matchProduct(productName, products);

  // Determine unit:
  // 1. If user explicitly typed a unit, always use it
  // 2. If no explicit unit and product matched, fall back to product's default unit
  // 3. If no explicit unit and unmatched, null
  let resolvedUnit = unit;
  if (!resolvedUnit && match) {
    const matchedProduct = products.find((p) => p.id === match.productId);
    resolvedUnit = matchedProduct?.defaultUnit ?? null;
  }

  return {
    rawText: raw.trim(),
    product: match?.productName ?? productName,
    productId: match?.productId ?? null,
    quantity,
    unit: normalizeUnit(resolvedUnit),
    matched: match !== null,
  };
}

export function parseSalesInput(
  text: string,
  products: ProductRecord[]
): { parsed: ParsedItem[]; unmatched: string[] } {
  // Step 1: Normalize
  let normalized = text.replace(FILLER_WORDS, " ").replace(/\s+/g, " ").trim();

  // Step 2: Tokenize by commas and "and"
  const tokens = normalized
    .split(/,|\band\b/i)
    .map((t) => t.trim())
    .filter(Boolean);

  // Step 3: Parse each token
  const parsed: ParsedItem[] = [];
  const seen = new Map<string, number>(); // product name → index in parsed array

  for (const token of tokens) {
    const item = parseToken(token, products);
    if (!item) continue;

    // Merge duplicates
    const key = item.product.toLowerCase();
    if (seen.has(key)) {
      const idx = seen.get(key)!;
      parsed[idx].quantity += item.quantity;
    } else {
      seen.set(key, parsed.length);
      parsed.push(item);
    }
  }

  const unmatched = parsed
    .filter((p) => !p.matched)
    .map((p) => p.product);

  return { parsed, unmatched };
}
