-- Histórico de preço dos veículos (selo "Baixou o preço" no estoque).
-- Cole no SQL Editor do Supabase (SQL Editor → New query → Run) ANTES do deploy
-- desta mudança. Idempotente: pode rodar mais de uma vez.
-- Só cria uma tabela nova; não altera "Vehicle" nem nenhum dado.
-- Se o deploy sair antes deste SQL, o site e o admin continuam funcionando:
-- o selo apenas não aparece e o preço não é registrado até a tabela existir.

CREATE TABLE IF NOT EXISTS "VehiclePriceHistory" (
  "id" TEXT PRIMARY KEY,
  "vehicleId" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehiclePriceHistory_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "VehiclePriceHistory_vehicleId_createdAt_idx" ON "VehiclePriceHistory"("vehicleId", "createdAt");

ALTER TABLE "VehiclePriceHistory" ENABLE ROW LEVEL SECURITY;
