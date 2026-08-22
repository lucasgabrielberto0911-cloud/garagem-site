-- Campos do site (Admin → Site) e aviso de vídeo no estoque.
-- Cole no SQL Editor do Supabase (SQL Editor → New query → Run).
-- Pode rodar mais de uma vez: só cria o que ainda não existe.

-- Vídeo do anúncio (checkbox no admin; não é player no site)
ALTER TABLE "Vehicle"
  ADD COLUMN IF NOT EXISTS "hasVideo" BOOLEAN NOT NULL DEFAULT false;

-- Google, FAQ, condições da ficha e foto do Elias
ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "googleRating" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "googleReviewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "googleProfileUrl" TEXT;
ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "faqJson" JSONB;
ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "conditionsTitle" TEXT;
ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "conditionsIntro" TEXT;
ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "conditionsJson" JSONB;
ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "founderPhotoUrl" TEXT;

-- Garante a linha única que o painel usa
INSERT INTO "SiteSettings" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
