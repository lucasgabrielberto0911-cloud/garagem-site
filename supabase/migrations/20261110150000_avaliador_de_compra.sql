-- Avaliador de compra (/admin/compra): PRs 1–4 do plano de 10/11/2026.
-- Aditiva e idempotente: só cria tabelas novas e relações opcionais. Não altera dados nem colunas existentes.
-- Sem estas tabelas o módulo avisa "indisponível" e nada quebra em cadastro, vendas ou Assistente.
-- Sem acesso por anon/authenticated (mesmo padrão do rls_hardening). O Prisma conecta privilegiado:
-- a autorização por admin criador fica no backend (src/lib/purchase-store.ts).
BEGIN;

CREATE TABLE IF NOT EXISTS "PurchaseEvaluation" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "requestKey" TEXT,
    "title" TEXT NOT NULL,
    "plate" TEXT,
    "vehicleId" TEXT,
    "leadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseEvaluationRevision" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "requestKey" TEXT,
    "createdById" TEXT NOT NULL,
    "askedPriceCents" INTEGER NOT NULL,
    "priceMode" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "fipeSnapshot" JSONB,
    "policySnapshot" JSONB NOT NULL,
    "evidenceSnapshot" JSONB,
    "output" JSONB NOT NULL,
    "score" JSONB NOT NULL,
    "scoreTotal" INTEGER,
    "scoreMin" INTEGER,
    "scoreMax" INTEGER,
    "verdict" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "scoreVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseEvaluationRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FipeMonthlyPrice" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "modelYear" INTEGER NOT NULL,
    "fuel" TEXT NOT NULL,
    "referenceMonth" TEXT NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "brandRaw" TEXT,
    "modelRaw" TEXT,
    "fuelRaw" TEXT,
    "sourceUrl" TEXT,
    "parserVersion" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FipeMonthlyPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VehicleFipeIdentity" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "modelYear" INTEGER NOT NULL,
    "fuel" TEXT NOT NULL,
    "versionLabel" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleFipeIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VehicleAcquisitionMetadata" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "stockEnteredAt" TIMESTAMP(3),
    "costsComplete" BOOLEAN NOT NULL DEFAULT false,
    "costsScope" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleAcquisitionMetadata_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchasePolicyVersion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'padrao',
    "version" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "body" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchasePolicyVersion_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE TABLE IF NOT EXISTS "FipeHistoryCache" (
  "key" TEXT PRIMARY KEY,
  "payload" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PurchaseEvaluation_adminId_updatedAt_idx" ON "PurchaseEvaluation"("adminId", "updatedAt");
CREATE INDEX IF NOT EXISTS "PurchaseEvaluation_vehicleId_idx" ON "PurchaseEvaluation"("vehicleId");
CREATE INDEX IF NOT EXISTS "PurchaseEvaluation_leadId_idx" ON "PurchaseEvaluation"("leadId");
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseEvaluation_adminId_requestKey_key" ON "PurchaseEvaluation"("adminId", "requestKey");
CREATE INDEX IF NOT EXISTS "PurchaseEvaluationRevision_createdById_createdAt_idx" ON "PurchaseEvaluationRevision"("createdById", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseEvaluationRevision_evaluationId_number_key" ON "PurchaseEvaluationRevision"("evaluationId", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseEvaluationRevision_evaluationId_requestKey_key" ON "PurchaseEvaluationRevision"("evaluationId", "requestKey");
CREATE INDEX IF NOT EXISTS "FipeMonthlyPrice_provider_code_modelYear_idx" ON "FipeMonthlyPrice"("provider", "code", "modelYear");
CREATE UNIQUE INDEX IF NOT EXISTS "FipeMonthlyPrice_provider_code_modelYear_fuel_referenceMont_key" ON "FipeMonthlyPrice"("provider", "code", "modelYear", "fuel", "referenceMonth");
CREATE UNIQUE INDEX IF NOT EXISTS "VehicleFipeIdentity_vehicleId_key" ON "VehicleFipeIdentity"("vehicleId");
CREATE UNIQUE INDEX IF NOT EXISTS "VehicleAcquisitionMetadata_vehicleId_key" ON "VehicleAcquisitionMetadata"("vehicleId");
CREATE UNIQUE INDEX IF NOT EXISTS "PurchasePolicyVersion_key_version_key" ON "PurchasePolicyVersion"("key", "version");

-- Chaves estrangeiras. Veículo/lead apagados não apagam a avaliação (SET NULL); revisões nunca somem em cascata.
ALTER TABLE "PurchaseEvaluation" DROP CONSTRAINT IF EXISTS "PurchaseEvaluation_adminId_fkey";
ALTER TABLE "PurchaseEvaluation" ADD CONSTRAINT "PurchaseEvaluation_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseEvaluation" DROP CONSTRAINT IF EXISTS "PurchaseEvaluation_vehicleId_fkey";
ALTER TABLE "PurchaseEvaluation" ADD CONSTRAINT "PurchaseEvaluation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseEvaluation" DROP CONSTRAINT IF EXISTS "PurchaseEvaluation_leadId_fkey";
ALTER TABLE "PurchaseEvaluation" ADD CONSTRAINT "PurchaseEvaluation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LeadVenda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseEvaluationRevision" DROP CONSTRAINT IF EXISTS "PurchaseEvaluationRevision_evaluationId_fkey";
ALTER TABLE "PurchaseEvaluationRevision" ADD CONSTRAINT "PurchaseEvaluationRevision_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "PurchaseEvaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleFipeIdentity" DROP CONSTRAINT IF EXISTS "VehicleFipeIdentity_vehicleId_fkey";
ALTER TABLE "VehicleFipeIdentity" ADD CONSTRAINT "VehicleFipeIdentity_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleAcquisitionMetadata" DROP CONSTRAINT IF EXISTS "VehicleAcquisitionMetadata_vehicleId_fkey";
ALTER TABLE "VehicleAcquisitionMetadata" ADD CONSTRAINT "VehicleAcquisitionMetadata_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integridade mínima dos valores (centavos inteiros, enums de texto).
ALTER TABLE "PurchaseEvaluation" DROP CONSTRAINT IF EXISTS "purchase_evaluation_status";
ALTER TABLE "PurchaseEvaluation" ADD CONSTRAINT "purchase_evaluation_status" CHECK ("status" IN ('rascunho','avaliada','arquivada'));
ALTER TABLE "PurchaseEvaluationRevision" DROP CONSTRAINT IF EXISTS "purchase_revision_values";
ALTER TABLE "PurchaseEvaluationRevision" ADD CONSTRAINT "purchase_revision_values" CHECK (
  "number" >= 1 AND "askedPriceCents" >= 0 AND "priceMode" IN ('fixo','negociavel')
  AND "verdict" IN ('compensa','atencao','nao_atende','pendente') AND "confidence" IN ('baixa','media','alta')
);
ALTER TABLE "FipeMonthlyPrice" DROP CONSTRAINT IF EXISTS "fipe_monthly_values";
ALTER TABLE "FipeMonthlyPrice" ADD CONSTRAINT "fipe_monthly_values" CHECK ("valueCents" > 0 AND "referenceMonth" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- Privado: RLS ligado e nenhum privilégio para anon/authenticated.
DO $$
DECLARE t text; r text;
BEGIN
  FOREACH t IN ARRAY ARRAY['PurchaseEvaluation','PurchaseEvaluationRevision','FipeMonthlyPrice','VehicleFipeIdentity','VehicleAcquisitionMetadata','PurchasePolicyVersion','FipeHistoryCache'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', t, r);
      END IF;
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.purchase_snapshot_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Snapshot publicado é imutável; crie uma nova revisão.';
END $$;
REVOKE ALL ON FUNCTION public.purchase_snapshot_immutable() FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.purchase_snapshot_immutable() FROM %I', r);
    END IF;
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS purchase_revision_immutable ON "PurchaseEvaluationRevision";
CREATE TRIGGER purchase_revision_immutable BEFORE UPDATE OR DELETE ON "PurchaseEvaluationRevision"
FOR EACH ROW EXECUTE FUNCTION public.purchase_snapshot_immutable();
DROP TRIGGER IF EXISTS purchase_policy_immutable ON "PurchasePolicyVersion";
CREATE TRIGGER purchase_policy_immutable BEFORE UPDATE OR DELETE ON "PurchasePolicyVersion"
FOR EACH ROW WHEN (OLD."publishedAt" IS NOT NULL) EXECUTE FUNCTION public.purchase_snapshot_immutable();

COMMIT;
