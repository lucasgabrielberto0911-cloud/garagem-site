-- Cidade física do veículo (Serra | Linhares) para Marketplace e o painel.
-- Cole no SQL Editor do Supabase (SQL Editor → New query → Run).
-- Idempotente: pode rodar mais de uma vez. NÃO use `prisma db push` no build.

ALTER TABLE "Vehicle"
  ADD COLUMN IF NOT EXISTS "locationCity" TEXT NOT NULL DEFAULT 'linhares';

CREATE INDEX IF NOT EXISTS "Vehicle_status_locationCity_idx"
  ON "Vehicle"("status", "locationCity");

-- Conferência: a coluna deve aparecer como text / not null / default linhares.
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Vehicle'
  AND column_name = 'locationCity';
