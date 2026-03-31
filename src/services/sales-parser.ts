import { matchProduct } from "./product-matcher";
import { KNOWN_UNITS } from "@/lib/constants";

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
};

const FILLER_WORDS = /\b(i|sold|today|about|around|approximately|roughly|some|of)\b/gi;
const UNIT_PATTERN = new RegExp(
  `(${KNOWN_UNITS.join("|")})`,
  "i"
);

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

  // Extract unit if adjacent to number or standalone
  const unitMatch = token.match(UNIT_PATTERN);
  if (unitMatch) {
    unit = unitMatch[1].toLowerCase();
    // Normalize common abbreviations
    if (unit === "l") unit = "liters";
    if (unit === "pcs") unit = "pieces";
    token = token.replace(UNIT_PATTERN, "").trim();
  }

  // Remaining text is the product name
  let productName = token.replace(FILLER_WORDS, "").replace(/\s+/g, " ").trim();
  if (!productName) return null;

  // Capitalize first letter
  productName = productName.charAt(0).toUpperCase() + productName.slice(1);

  // Match against known products
  const match = matchProduct(productName, products);

  return {
    rawText: raw.trim(),
    product: match?.productName ?? productName,
    productId: match?.productId ?? null,
    quantity,
    unit: unit ?? match?.productId
      ? products.find((p) => p.id === match?.productId)?.defaultUnit ?? null
      : null,
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
