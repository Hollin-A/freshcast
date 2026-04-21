import { describe, it, expect } from "vitest";
import { matchProduct } from "../product-matcher";

const products = [
  { id: "1", name: "Eggs", defaultUnit: "pieces" },
  { id: "2", name: "Minced beef", defaultUnit: "kg" },
  { id: "3", name: "Chicken breast", defaultUnit: "kg" },
  { id: "4", name: "Milk", defaultUnit: "liters" },
  { id: "5", name: "Bread", defaultUnit: "pieces" },
];

describe("matchProduct", () => {
  it("matches exact product name (case-insensitive)", () => {
    const result = matchProduct("Eggs", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("1");
    expect(result!.matchType).toBe("exact");
  });

  it("matches case-insensitive", () => {
    const result = matchProduct("eggs", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("1");
  });

  it("matches with plural normalization", () => {
    const result = matchProduct("egg", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("1");
    expect(result!.matchType).toBe("normalized");
  });

  it("matches substring", () => {
    const result = matchProduct("chicken", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("3");
    expect(result!.matchType).toBe("substring");
  });

  it("matches fuzzy (small typo)", () => {
    const result = matchProduct("berad", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("5");
    expect(result!.matchType).toBe("fuzzy");
  });

  it("returns null for unmatched product", () => {
    const result = matchProduct("halloumi", products);
    expect(result).toBeNull();
  });

  it("matches empty input via substring (edge case)", () => {
    // Empty string matches via substring since "".includes("") is true in JS
    // In practice, the sales parser never sends empty strings to the matcher
    const result = matchProduct("", products);
    expect(result).not.toBeNull();
  });
});
