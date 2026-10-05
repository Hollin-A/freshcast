import * as z from "zod";
import { RECEIPT_MAX_UPLOAD_BYTES } from "@/lib/constants";

// POST /api/receipts/upload
export const receiptUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(RECEIPT_MAX_UPLOAD_BYTES, { error: "Receipt image must be 10 MB or smaller" }),
});

// POST /api/receipts/parse
export const parseReceiptSchema = z.object({
  key: z.string().min(1).max(1024),
});
