-- Remove Photo.hasPlate depois que o blur manual estiver no ar.
-- O código novo não lê nem grava essa coluna.
-- Rode só DEPOIS do deploy. Se rodar antes, o admin antigo quebra ao salvar fotos.
-- Cole no SQL Editor do Supabase. Idempotente.

ALTER TABLE "Photo" DROP COLUMN IF EXISTS "hasPlate";
