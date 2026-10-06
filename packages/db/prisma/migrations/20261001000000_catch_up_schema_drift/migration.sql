-- Catch-up migration: records schema changes that were applied with
-- `prisma db push` and never captured as migrations (see ADR-014 for the
-- dropped unique index). Existing databases already have these changes and
-- mark this migration as applied with `prisma migrate resolve --applied`.

-- DropIndex
DROP INDEX "SalesEntry_businessId_date_key";

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "region" TEXT NOT NULL DEFAULT 'AU-VIC',
ADD COLUMN     "weeklyEmailEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DailyInsight" ADD COLUMN     "generationMethod" TEXT NOT NULL DEFAULT 'template';

-- AlterTable
ALTER TABLE "SalesEntry" ADD COLUMN     "rawInput" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "DailyInsight_businessId_date_type_key" ON "DailyInsight"("businessId", "date", "type");
