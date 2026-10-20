-- Aplicar somente após revisão, em ambiente isolado primeiro.
BEGIN;

-- CreateTable
CREATE TABLE "VehicleReservation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "deposit" DECIMAL(12,2) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAssessment" (
    "vehicleId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "notes" TEXT NOT NULL,
    "offer" DECIMAL(12,2) NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleAssessment_pkey" PRIMARY KEY ("vehicleId")
);

-- CreateTable
CREATE TABLE "FinanceSimulation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "downPayment" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(6,3) NOT NULL,
    "months" INTEGER NOT NULL,
    "installment" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'simulacao',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialDocument" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfterSaleTask" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AfterSaleTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleReservation_status_expiresAt_idx" ON "VehicleReservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "VehicleReservation_vehicleId_idx" ON "VehicleReservation"("vehicleId");

-- CreateIndex
CREATE INDEX "FinanceSimulation_vehicleId_createdAt_idx" ON "FinanceSimulation"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "CommercialDocument_vehicleId_createdAt_idx" ON "CommercialDocument"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "AfterSaleTask_completedAt_dueAt_idx" ON "AfterSaleTask"("completedAt", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "AfterSaleTask_saleId_kind_key" ON "AfterSaleTask"("saleId", "kind");

-- AddForeignKey
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "VehicleReservation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "VehicleReservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssessment" ADD CONSTRAINT "VehicleAssessment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSimulation" ADD CONSTRAINT "FinanceSimulation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialDocument" ADD CONSTRAINT "CommercialDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSaleTask" ADD CONSTRAINT "AfterSaleTask_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Uma única reserva ativa por veículo, inclusive sob concorrência.
CREATE UNIQUE INDEX "VehicleReservation_active_key" ON "VehicleReservation"("vehicleId") WHERE "status" = 'ativa';
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "reservation_values" CHECK ("deposit" >= 0 AND "expiresAt" > "createdAt");
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "reservation_status" CHECK ("status" IN ('ativa','cancelada','expirada','convertida'));
ALTER TABLE "FinanceSimulation" ADD CONSTRAINT "finance_values" CHECK ("price" > 0 AND "downPayment" >= 0 AND "downPayment" < "price" AND "rate" >= 0 AND "rate" <= 10 AND "months" BETWEEN 1 AND 120);
ALTER TABLE "VehicleReservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VehicleAssessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinanceSimulation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommercialDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AfterSaleTask" ENABLE ROW LEVEL SECURITY;
COMMIT;
