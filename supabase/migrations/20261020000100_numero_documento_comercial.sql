-- Aplicar somente após revisão, em ambiente isolado primeiro.
-- Número sequencial (único) para propostas e recibos. Idempotente: pode rodar mais de uma vez.
-- Linhas existentes recebem número na criação da coluna (substitui o antigo prisma/sql/commercial-document-number.sql).
BEGIN;

CREATE SEQUENCE IF NOT EXISTS "CommercialDocument_number_seq";

ALTER TABLE "CommercialDocument"
  ADD COLUMN IF NOT EXISTS "number" INTEGER NOT NULL DEFAULT nextval('"CommercialDocument_number_seq"');

ALTER SEQUENCE "CommercialDocument_number_seq" OWNED BY "CommercialDocument"."number";

CREATE UNIQUE INDEX IF NOT EXISTS "CommercialDocument_number_key" ON "CommercialDocument"("number");

COMMIT;
