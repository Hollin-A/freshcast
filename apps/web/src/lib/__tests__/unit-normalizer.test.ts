import { describe, it, expect } from "vitest";
import { normalizeUnit } from "../unit-normalizer";

describe("normalizeUnit", () => {
  it("returns null for null/undefined input", () => {
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit(undefined)).toBeNull();
    expect(normalizeUnit("")).toBeNull();
  });

  it("normalizes weight units", () => {
    expect(normalizeUnit("Kg")).toBe("kg");
    expect(normalizeUnit("kgs")).toBe("kg");
    expect(normalizeUnit("kilogram")).toBe("kg");
    expect(normalizeUnit("kilos")).toBe("kg");
    expect(normalizeUnit("g")).toBe("g");
    expect(normalizeUnit("grams")).toBe("g");
  });

  it("normalizes volume units", () => {
    expect(normalizeUnit("L")).toBe("liters");
    expect(normalizeUnit("Litre")).toBe("liters");
    expect(normalizeUnit("litres")).toBe("liters");
    expect(normalizeUnit("liter")).toBe("liters");
    expect(normalizeUnit("ml")).toBe("ml");
  });

  it("normalizes count units", () => {
    expect(normalizeUnit("pcs")).toBe("pieces");
    expect(normalizeUnit("piece")).toBe("pieces");
    expect(normalizeUnit("bottles")).toBe("bottles");
    expect(normalizeUnit("dozen")).toBe("dozen");
    expect(normalizeUnit("loaf")).toBe("loaves");
  });

  it("returns lowercase original for unknown units", () => {
    expect(normalizeUnit("scoops")).toBe("scoops");
    expect(normalizeUnit("CUPS")).toBe("cups");
  });
});
