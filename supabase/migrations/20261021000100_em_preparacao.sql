-- Aplicar somente após revisão, em ambiente isolado primeiro.
-- Aditiva: só cria a tabela de carros comprados ainda em preparação (uso interno do painel).
BEGIN;

-- CreateTable
CREATE TABLE "PreparationVehicle" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "color" TEXT,
    "year" INTEGER,
    "km" INTEGER,
    "plate" TEXT,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "posted" BOOLEAN NOT NULL DEFAULT false,
    "purchasedAt" TIMESTAMP(3),
    "purchasePrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreparationVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreparationVehicle_createdAt_idx" ON "PreparationVehicle"("createdAt");

ALTER TABLE "PreparationVehicle" ENABLE ROW LEVEL SECURITY;

COMMIT;
