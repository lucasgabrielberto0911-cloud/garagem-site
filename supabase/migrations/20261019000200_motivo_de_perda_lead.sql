-- Motivo de perda / objeção principal do lead.
-- Cole no SQL Editor do Supabase antes ou depois do deploy. Idempotente.

ALTER TABLE "LeadVenda"
  ADD COLUMN IF NOT EXISTS "lostReason" TEXT;

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'LeadVenda'
  AND column_name = 'lostReason';
