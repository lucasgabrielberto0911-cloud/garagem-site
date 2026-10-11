-- Índices aditivos (não alteram dados). Cole no SQL Editor do Supabase se o
-- prisma db push ainda não tiver rodado em produção.
-- O Supabase Advisor apontava a chave estrangeira Sale.customerId sem índice.

CREATE INDEX IF NOT EXISTS "Sale_customerId_idx" ON "Sale" ("customerId");
CREATE INDEX IF NOT EXISTS "LeadVenda_status_createdAt_idx" ON "LeadVenda" ("status", "createdAt");
