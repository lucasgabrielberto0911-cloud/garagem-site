-- Aplicar somente após revisão, em ambiente isolado primeiro.
-- Número sequencial (único) para propostas e recibos. Linhas existentes recebem número na criação da coluna.
BEGIN;

ALTER TABLE "CommercialDocument" ADD COLUMN "number" SERIAL NOT NULL;

CREATE UNIQUE INDEX "CommercialDocument_number_key" ON "CommercialDocument"("number");

COMMIT;
