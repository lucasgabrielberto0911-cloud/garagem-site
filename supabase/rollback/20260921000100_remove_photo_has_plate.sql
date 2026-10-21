-- Rollback de 20260921000100_remove_photo_has_plate: recria a coluna (os valores antigos não voltam).
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "hasPlate" BOOLEAN NOT NULL DEFAULT false;
