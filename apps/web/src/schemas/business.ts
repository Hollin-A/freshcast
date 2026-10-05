import * as z from "zod";
import { BUSINESS_TYPES } from "@/lib/constants";
import { productInputSchema } from "./products";

// POST /api/business
export const createBusinessSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(BUSINESS_TYPES),
  locale: z.string().min(2).max(10).default("en"),
  timezone: z.string().min(1).max(50).default("UTC"),
  products: z.array(productInputSchema).min(1).max(10),
});

// PATCH /api/business
export const updateBusinessSchema = z.object({
  weeklyEmailEnabled: z.boolean().optional(),
});

// Onboarding step 1 form
export const businessDetailsFormSchema = z.object({
  name: z.string().min(1, { error: "Business name is required" }).max(100),
  type: z.enum(BUSINESS_TYPES, { error: "Please select a business type" }),
});
export type BusinessDetailsFormValues = z.infer<typeof businessDetailsFormSchema>;
