-- Campos extras do lead de venda/troca (interesse, origem, fotos, updatedAt).
-- Cole no SQL Editor do Supabase. Idempotente.

ALTER TABLE "LeadVenda"
  ADD COLUMN IF NOT EXISTS "interestVehicleId" TEXT;
ALTER TABLE "LeadVenda"
  ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "LeadVenda"
  ADD COLUMN IF NOT EXISTS "photoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "LeadVenda"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'LeadVenda'
  AND column_name IN ('interestVehicleId', 'source', 'photoUrls', 'updatedAt')
ORDER BY column_name;
