import * as z from "zod";

// POST /api/receipts/upload
export const receiptUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
});

// POST /api/receipts/parse
export const parseReceiptSchema = z.object({
  key: z.string().min(1).max(1024),
});
