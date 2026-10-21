-- Operação interna por veículo (custos, documentos, checklist).
-- Cole no SQL Editor do Supabase e rode uma vez antes do deploy.

ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inStoreName" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "hasSpareKey" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "hasManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "purchasePrice" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "VehicleCost" (
  "id" TEXT PRIMARY KEY,
  "vehicleId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "amount" DOUBLE PRECISION NOT NULL,
  "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receiptUrl" TEXT,
  "receiptName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehicleCost_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "VehicleCost_vehicleId_incurredAt_idx" ON "VehicleCost"("vehicleId", "incurredAt");

CREATE TABLE IF NOT EXISTS "VehicleDocument" (
  "id" TEXT PRIMARY KEY,
  "vehicleId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehicleDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "VehicleDocument_vehicleId_idx" ON "VehicleDocument"("vehicleId");
