-- Aplicar somente após revisão, em ambiente isolado primeiro.
-- Aditiva e idempotente: chassi/RENAVAM no veículo e RG no cliente, para o contrato sair preenchido. Não apaga nada.
BEGIN;

ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "chassis" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "renavam" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "rg" TEXT;

COMMIT;
