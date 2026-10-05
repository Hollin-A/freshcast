import { describe, it, expect } from "vitest";
import { parseSalesInput } from "../sales-parser";

const products = [
  { id: "1", name: "Eggs", defaultUnit: "pieces" },
  { id: "2", name: "Minced beef", defaultUnit: "kg" },
  { id: "3", name: "Chicken breast", defaultUnit: "kg" },
  { id: "4", name: "Milk", defaultUnit: "liters" },
  { id: "5", name: "Bread", defaultUnit: "pieces" },
];

describe("parseSalesInput", () => {
  it("parses simple NL input", () => {
    const result = parseSalesInput("20 eggs", products);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].product).toBe("Eggs");
    expect(result.parsed[0].quantity).toBe(20);
    expect(result.parsed[0].matched).toBe(true);
  });

  it("parses multiple items separated by commas", () => {
    const result = parseSalesInput("20 eggs, 30kg beef, 10 milk", products);
    expect(result.parsed.length).toBeGreaterThanOrEqual(2);
    const eggs = result.parsed.find((p) => p.product === "Eggs");
    expect(eggs).toBeDefined();
    expect(eggs!.quantity).toBe(20);
  });

  it("parses items separated by 'and'", () => {
    const result = parseSalesInput("20 eggs and 10 bread", products);
    expect(result.parsed).toHaveLength(2);
  });

  it("extracts units correctly", () => {
    const result = parseSalesInput("5kg minced beef", products);
    const beef = result.parsed.find((p) => p.product === "Minced beef");
    expect(beef).toBeDefined();
    expect(beef!.quantity).toBe(5);
    expect(beef!.unit).toBe("kg");
  });

  it("uses product default unit when no unit specified", () => {
    const result = parseSalesInput("20 eggs", products);
    expect(result.parsed[0].unit).toBe("pieces");
  });

  it("flags unmatched products", () => {
    const result = parseSalesInput("8 halloumi", products);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].matched).toBe(false);
    expect(result.unmatched).toContain("Halloumi");
  });

  it("returns empty for empty input", () => {
    const result = parseSalesInput("", products);
    expect(result.parsed).toHaveLength(0);
  });

  it("returns empty for input with no quantities", () => {
    const result = parseSalesInput("eggs and milk", products);
    expect(result.parsed).toHaveLength(0);
  });

  it("handles 'sold' filler word", () => {
    const result = parseSalesInput("sold 20 eggs", products);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].quantity).toBe(20);
  });

  it("merges duplicate products", () => {
    const result = parseSalesInput("10 eggs, 5 eggs", products);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].quantity).toBe(15);
  });
});
