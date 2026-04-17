/**
 * Normalize unit strings to a consistent format.
 * Handles variations from both LLM and rule-based parsers.
 */

const UNIT_MAP: Record<string, string> = {
  // Weight
  kg: "kg",
  kgs: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  kilos: "kg",
  g: "g",
  gram: "g",
  grams: "g",
  lb: "lbs",
  lbs: "lbs",
  pound: "lbs",
  pounds: "lbs",

  // Volume
  l: "liters",
  liter: "liters",
  liters: "liters",
  litre: "liters",
  litres: "liters",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  gallon: "gallons",
  gallons: "gallons",

  // Count
  piece: "pieces",
  pieces: "pieces",
  pcs: "pieces",
  pc: "pieces",
  unit: "units",
  units: "units",
  dozen: "dozen",
  bottle: "bottles",
  bottles: "bottles",
  pack: "packs",
  packs: "packs",
  bunch: "bunches",
  bunches: "bunches",
  loaf: "loaves",
  loaves: "loaves",
  can: "cans",
  cans: "cans",
  box: "boxes",
  boxes: "boxes",
  bag: "bags",
  bags: "bags",
  tray: "trays",
  trays: "trays",
  carton: "cartons",
  cartons: "cartons",
};

export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const lower = unit.toLowerCase().trim();
  return UNIT_MAP[lower] ?? lower;
}
