BEGIN;
-- Preserva o histórico financeiro e reconhece reenvios da mesma solicitação.
ALTER TABLE "VehicleReservation" DROP CONSTRAINT IF EXISTS "VehicleReservation_vehicleId_fkey";
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "VehicleReservation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialDocument" DROP CONSTRAINT IF EXISTS "CommercialDocument_vehicleId_fkey";
ALTER TABLE "CommercialDocument" ADD CONSTRAINT "CommercialDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromissoryNote" ADD COLUMN IF NOT EXISTS "issuanceKey" TEXT;
ALTER TABLE "PromissoryNote" ADD COLUMN IF NOT EXISTS "issuanceHash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "PromissoryNote_issuanceKey_installmentNo_key" ON "PromissoryNote"("issuanceKey", "installmentNo");
ALTER TABLE "LeadVenda" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "LeadVenda_requestId_key" ON "LeadVenda"("requestId");
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
COMMIT;
