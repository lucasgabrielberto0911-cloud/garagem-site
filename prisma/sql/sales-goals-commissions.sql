-- Metas mensais e comissões de vendas
-- Cole no SQL Editor do Supabase e rode uma vez antes do deploy.

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "sellerName" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "commission" DOUBLE PRECISION;

ALTER TABLE "SiteContent" ADD COLUMN IF NOT EXISTS "salesGoalUnits" INTEGER DEFAULT 10;
ALTER TABLE "SiteContent" ADD COLUMN IF NOT EXISTS "salesGoalRevenue" DOUBLE PRECISION DEFAULT 500000;
ALTER TABLE "SiteContent" ADD COLUMN IF NOT EXISTS "defaultCommissionRate" DOUBLE PRECISION DEFAULT 1.5;
