import { describe, it, expect } from "vitest";
import { ruleBasedReceiptParse } from "../rule-based-receipt-parser";
import type { ReceiptLineItem } from "@/lib/textract";

const products = [
  { id: "1", name: "Eggs", defaultUnit: "pieces" },
  { id: "2", name: "Minced beef", defaultUnit: "kg" },
  { id: "3", name: "Chicken breast", defaultUnit: "kg" },
  { id: "4", name: "Milk", defaultUnit: "liters" },
  { id: "5", name: "Bread", defaultUnit: "pieces" },
];

function lineItem(overrides: Partial<ReceiptLineItem> & { description: string }): ReceiptLineItem {
  return {
    description: overrides.description,
    quantity: overrides.quantity ?? null,
    unit: overrides.unit ?? null,
    unitPrice: overrides.unitPrice ?? null,
    total: overrides.total ?? null,
    rawRow: overrides.rawRow ?? null,
  };
}

describe("ruleBasedReceiptParse", () => {
  it("matches descriptions to known products and uses AWS quantities verbatim", () => {
    const items = [
      lineItem({ description: "Eggs", quantity: 12 }),
      lineItem({ description: "Bread", quantity: 3 }),
    ];
    const result = ruleBasedReceiptParse(items, products);
    expect(result.parsed).toHaveLength(2);
    expect(result.parsed[0]).toMatchObject({ product: "Eggs", quantity: 12, matched: true });
    expect(result.parsed[1]).toMatchObject({ product: "Bread", quantity: 3, matched: true });
    expect(result.unmatched).toEqual([]);
  });

  it("defaults quantity to 1 when AWS did not detect one", () => {
    const items = [lineItem({ description: "Eggs" })];
    const result = ruleBasedReceiptParse(items, products);
    expect(result.parsed[0].quantity).toBe(1);
    expect(result.parsed[0].matched).toBe(true);
  });

  it("filters out receipt noise lines", () => {
    const items = [
      lineItem({ description: "Eggs", quantity: 12 }),
      lineItem({ description: "TOTAL", quantity: null, total: 24.5 }),
      lineItem({ description: "GST", quantity: null, total: 2.45 }),
      lineItem({ description: "EFTPOS", quantity: null }),
      lineItem({ description: "CHANGE", quantity: null }),
    ];
    const result = ruleBasedReceiptParse(items, products);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].product).toBe("Eggs");
  });

  it("flags genuinely unknown items as unmatched without crashing", () => {
    const items = [
      lineItem({ description: "Halloumi", quantity: 2 }),
      lineItem({ description: "Eggs", quantity: 12 }),
    ];
    const result = ruleBasedReceiptParse(items, products);
    expect(result.parsed).toHaveLength(2);
    const halloumi = result.parsed.find((p) => p.product.toLowerCase() === "halloumi");
    expect(halloumi).toBeDefined();
    expect(halloumi!.matched).toBe(false);
    expect(result.unmatched).toContain("Halloumi");
  });

  it("infers unit from descriptions like '500G' and '2L'", () => {
    const items = [
      lineItem({ description: "Eggs 500G", quantity: 1 }),
      lineItem({ description: "Milk 2L", quantity: 1 }),
    ];
    const result = ruleBasedReceiptParse(items, products);
    const eggs = result.parsed.find((p) => p.product === "Eggs");
    const milk = result.parsed.find((p) => p.product === "Milk");
    expect(eggs?.unit).toBe("g");
    expect(milk?.unit).toBe("liters");
  });

  it("falls back to the matched product's default unit when no inferred unit is present", () => {
    const items = [lineItem({ description: "Minced beef", quantity: 5 })];
    const result = ruleBasedReceiptParse(items, products);
    expect(result.parsed[0].unit).toBe("kg");
  });

  it("ignores empty descriptions and zero/negative quantities", () => {
    const items = [
      lineItem({ description: "", quantity: 5 }),
      lineItem({ description: "Eggs", quantity: 0 }),
      lineItem({ description: "Bread", quantity: -1 }),
      lineItem({ description: "Milk", quantity: 2 }),
    ];
    const result = ruleBasedReceiptParse(items, products);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].product).toBe("Milk");
  });

  it("uses rawRow when present for the parsed item's rawText", () => {
    const items = [
      lineItem({ description: "Eggs", quantity: 12, rawRow: "FREE RANGE EGGS 12PK $9.50" }),
    ];
    const result = ruleBasedReceiptParse(items, products);
    expect(result.parsed[0].rawText).toBe("FREE RANGE EGGS 12PK $9.50");
  });
});
