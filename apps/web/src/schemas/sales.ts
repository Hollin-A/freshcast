import * as z from "zod";

const salesItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().optional().nullable(),
});

const salesItemsSchema = z.array(salesItemInputSchema).min(1).max(50);

// POST /api/sales
export const createSalesSchema = z.object({
  date: z.string().date(),
  inputMethod: z.enum(["NATURAL_LANGUAGE", "MANUAL"]),
  rawInput: z.string().max(1000).optional().nullable(),
  receiptKey: z.string().max(1024).optional().nullable(),
  items: salesItemsSchema,
});

// PATCH /api/sales/[id]
export const updateSalesItemsSchema = z.object({
  items: salesItemsSchema,
});

// POST /api/sales/parse
export const parseSalesSchema = z.object({
  text: z.string().min(1).max(1000),
});

// One parsed line from the sales and receipt parsers, shown on the
// confirmation screen before saving.
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
