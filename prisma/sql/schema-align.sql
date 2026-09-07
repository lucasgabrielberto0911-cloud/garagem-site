-- Alinha o banco de produção com prisma/schema.prisma.
-- Cole no SQL Editor do Supabase (SQL Editor → New query → Run).
-- Idempotente: pode rodar mais de uma vez. NÃO use `prisma db push` no build.

-- Depoimentos: a coluna `rating` faltava em produção e gerava P2022 em toda página.
ALTER TABLE "Testimonial"
  ADD COLUMN IF NOT EXISTS "rating" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Testimonial"
  ADD COLUMN IF NOT EXISTS "vehicleLabel" TEXT;
ALTER TABLE "Testimonial"
  ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "Testimonial"
  ADD COLUMN IF NOT EXISTS "published" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Testimonial"
  ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

-- Miniaturas das fotos (cards do estoque / home).
ALTER TABLE "Photo"
  ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;

-- Lead de venda/troca: interesse no estoque, origem, fotos e updatedAt.
ALTER TABLE "LeadVenda"
  ADD COLUMN IF NOT EXISTS "interestVehicleId" TEXT;
ALTER TABLE "LeadVenda"
  ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "LeadVenda"
  ADD COLUMN IF NOT EXISTS "photoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "LeadVenda"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Conferência rápida (deve listar rating, thumbnailUrl e campos novos do lead).
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'Testimonial' AND column_name IN ('rating', 'vehicleLabel', 'photoUrl', 'published', 'order'))
    OR (table_name = 'Photo' AND column_name = 'thumbnailUrl')
    OR (table_name = 'LeadVenda' AND column_name IN ('interestVehicleId', 'source', 'photoUrls', 'updatedAt'))
  )
ORDER BY table_name, column_name;
