-- Número sequencial do recibo/proposta (CommercialDocument.number).
-- Cole no SQL Editor do Supabase (SQL Editor → New query → Run).
-- Idempotente e só aditivo: pode rodar mais de uma vez. NÃO use `prisma db push` no build.
-- Linhas antigas recebem número pela ordem de criação ao adicionar a coluna.

CREATE SEQUENCE IF NOT EXISTS "CommercialDocument_number_seq";

ALTER TABLE "CommercialDocument"
  ADD COLUMN IF NOT EXISTS "number" INTEGER NOT NULL DEFAULT nextval('"CommercialDocument_number_seq"');

ALTER SEQUENCE "CommercialDocument_number_seq" OWNED BY "CommercialDocument"."number";

CREATE UNIQUE INDEX IF NOT EXISTS "CommercialDocument_number_key"
  ON "CommercialDocument"("number");

-- Conferência: coluna integer / not null / default nextval.
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'CommercialDocument'
  AND column_name = 'number';
