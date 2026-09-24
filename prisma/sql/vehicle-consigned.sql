-- Flag interna "Consignado" (carro de terceiro vendido pela loja).
-- Cole no SQL Editor do Supabase (SQL Editor → New query → Run) ANTES do deploy.
-- Idempotente: pode rodar mais de uma vez. Veículos existentes ficam false.

ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "consigned" BOOLEAN NOT NULL DEFAULT false;

-- Conferência: a coluna deve aparecer como boolean / not null / default false.
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Vehicle'
  AND column_name = 'consigned';
