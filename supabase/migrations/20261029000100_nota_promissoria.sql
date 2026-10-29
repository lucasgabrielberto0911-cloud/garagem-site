-- Aplicar somente após revisão, em ambiente isolado primeiro. Idempotente (o CI roda sobre o schema do Prisma).
-- Aditiva: só cria a tabela das notas promissórias (aba Promissórias do painel). Não altera tabelas existentes.
BEGIN;

CREATE SEQUENCE IF NOT EXISTS "PromissoryNote_number_seq";

-- CreateTable
CREATE TABLE IF NOT EXISTS "PromissoryNote" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL DEFAULT nextval('"PromissoryNote_number_seq"'),
    "customerId" TEXT,
    "issuerName" TEXT NOT NULL,
    "issuerCpf" TEXT NOT NULL,
    "issuerRg" TEXT,
    "issuerBirthDate" DATE NOT NULL,
    "issuerPhone" TEXT NOT NULL,
    "issuerAddress" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "issuedAt" DATE NOT NULL,
    "issuePlace" TEXT NOT NULL,
    "paymentPlace" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL DEFAULT 1,
    "installmentCount" INTEGER NOT NULL DEFAULT 1,
    "saleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'emitida',
    "paidAt" TIMESTAMP(3),
    "paidNoticeDoneAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromissoryNote_pkey" PRIMARY KEY ("id")
);

ALTER SEQUENCE "PromissoryNote_number_seq" OWNED BY "PromissoryNote"."number";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PromissoryNote_number_key" ON "PromissoryNote"("number");
CREATE INDEX IF NOT EXISTS "PromissoryNote_status_dueDate_idx" ON "PromissoryNote"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "PromissoryNote_customerId_idx" ON "PromissoryNote"("customerId");
CREATE INDEX IF NOT EXISTS "PromissoryNote_saleId_idx" ON "PromissoryNote"("saleId");
CREATE INDEX IF NOT EXISTS "PromissoryNote_paidAt_paidNoticeDoneAt_idx" ON "PromissoryNote"("paidAt", "paidNoticeDoneAt");

-- AddForeignKey
ALTER TABLE "PromissoryNote" DROP CONSTRAINT IF EXISTS "PromissoryNote_customerId_fkey";
ALTER TABLE "PromissoryNote" ADD CONSTRAINT "PromissoryNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromissoryNote" DROP CONSTRAINT IF EXISTS "PromissoryNote_saleId_fkey";
ALTER TABLE "PromissoryNote" ADD CONSTRAINT "PromissoryNote_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromissoryNote" DROP CONSTRAINT IF EXISTS "promissory_status";
ALTER TABLE "PromissoryNote" ADD CONSTRAINT "promissory_status" CHECK ("status" IN ('emitida','vinculada','paga','cancelada'));
ALTER TABLE "PromissoryNote" DROP CONSTRAINT IF EXISTS "promissory_values";
ALTER TABLE "PromissoryNote" ADD CONSTRAINT "promissory_values" CHECK ("amount" > 0 AND "dueDate" >= "issuedAt" AND "installmentNo" BETWEEN 1 AND "installmentCount");

ALTER TABLE "PromissoryNote" ENABLE ROW LEVEL SECURITY;

COMMIT;
