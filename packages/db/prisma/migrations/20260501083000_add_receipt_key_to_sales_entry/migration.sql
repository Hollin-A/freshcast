-- Add optional S3 receipt key for OCR-origin sales entries
ALTER TABLE "SalesEntry"
ADD COLUMN "receiptKey" TEXT;
