-- Rollback de 20261021000200_contrato_chassi_renavam_rg.sql.
-- ATENÇÃO: apaga os dados dessas colunas. Faça backup antes se já houver chassi/RENAVAM/RG preenchidos.
BEGIN;

ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "chassis";
ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "renavam";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "rg";

COMMIT;
