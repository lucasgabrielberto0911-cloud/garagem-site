-- Agenda: teste local com 100 mil leads (20% ativos), SQL parametrizado emitido pelo Prisma, EXPLAIN ANALYZE/BUFFERS.
-- Lista do dia: 12,389 → 0,052 ms; contagem de atrasados: 12,570 → 3,611 ms.
-- Não aplicado no banco compartilhado. O coordenador decide a aplicação.
CREATE INDEX IF NOT EXISTS "LeadVenda_agenda_ativa_idx"
  ON "LeadVenda" ("nextActionAt", "id")
  WHERE "status" NOT IN ('fechado', 'perdido')
    AND "nextActionAt" IS NOT NULL;
