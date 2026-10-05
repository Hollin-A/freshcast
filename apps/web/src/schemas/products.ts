import * as z from "zod";

// POST /api/products, and each product in POST /api/business
export const productInputSchema = z.object({
  name: z.string().min(1).max(100),
  defaultUnit: z.string().max(20).optional(),
});

// PATCH /api/products
export const updateProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  defaultUnit: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
});
