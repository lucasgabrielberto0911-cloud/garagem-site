-- Revisar e aplicar ANTES de publicar este PR. Somente adições, sem reescalar dinheiro.
-- Novas tabelas são privadas e acessadas pelo servidor Prisma da aplicação.
BEGIN;
-- AlterTable
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "LeadVenda" ADD COLUMN IF NOT EXISTS "nextAction" TEXT,
ADD COLUMN IF NOT EXISTS "nextActionAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminDraft" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminAudit" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminLoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminLoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminDraft_expiresAt_idx" ON "AdminDraft"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdminDraft_adminId_key_key" ON "AdminDraft"("adminId", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAudit_entityId_createdAt_idx" ON "AdminAudit"("entityId", "createdAt");

CREATE INDEX IF NOT EXISTS "AdminAudit_createdAt_idx" ON "AdminAudit"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadActivity_leadId_fkey') THEN
    ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LeadVenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;


ALTER TABLE "AdminDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminLoginAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadActivity" ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "AdminDraft", "AdminAudit", "AdminLoginAttempt", "LeadActivity" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
COMMIT;
