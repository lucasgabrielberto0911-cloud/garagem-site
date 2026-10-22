ALTER TABLE "Vehicle"
  ADD COLUMN IF NOT EXISTS "soldAt" TIMESTAMP(3);

UPDATE "Vehicle" AS vehicle
SET "soldAt" = sale."saleDate"
FROM "Sale" AS sale
WHERE sale."vehicleId" = vehicle."id"
  AND vehicle."status" = 'vendido'
  AND vehicle."soldAt" IS NULL;
