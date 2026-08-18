-- Índice para filtros de categoria no estoque público (Carro / Moto).
-- Cole no SQL Editor do Supabase se o prisma db push ainda não tiver rodado.

CREATE INDEX IF NOT EXISTS "Vehicle_status_category_idx" ON "Vehicle" ("status", "category");
