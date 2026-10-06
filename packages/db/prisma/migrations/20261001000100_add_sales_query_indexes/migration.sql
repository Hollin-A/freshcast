-- CreateIndex
CREATE INDEX "SalesEntry_businessId_date_idx" ON "SalesEntry"("businessId", "date");

-- CreateIndex
CREATE INDEX "SalesItem_salesEntryId_idx" ON "SalesItem"("salesEntryId");

