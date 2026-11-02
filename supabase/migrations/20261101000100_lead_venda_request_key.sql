-- Chave de idempotência da avaliação (/vender): reenvio da mesma solicitação não duplica o lead.
ALTER TABLE "LeadVenda"
  ADD COLUMN IF NOT EXISTS "requestKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "LeadVenda_requestKey_key"
  ON "LeadVenda" ("requestKey");
