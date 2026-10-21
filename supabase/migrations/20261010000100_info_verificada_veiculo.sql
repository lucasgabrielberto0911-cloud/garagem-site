-- Informações verificadas por veículo ("Verificado neste carro" na ficha).
-- Cole no SQL Editor do Supabase (SQL Editor → New query → Run) ANTES do deploy
-- desta mudança. Idempotente: pode rodar mais de uma vez.
-- Só cria uma tabela nova e opcional; não altera "Vehicle" nem nenhum dado.
-- Se o deploy sair antes deste SQL, o site e o admin continuam funcionando:
-- a ficha apenas não mostra a seção e a aba "Verificado" avisa que falta rodar o SQL.

CREATE TABLE IF NOT EXISTS "VehicleVerifiedInfo" (
  "id" TEXT PRIMARY KEY,
  "vehicleId" TEXT NOT NULL,
  "items" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehicleVerifiedInfo_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "VehicleVerifiedInfo_vehicleId_key" ON "VehicleVerifiedInfo"("vehicleId");

-- Mesmo padrão das outras tabelas: sem acesso direto pela API pública do Supabase
-- (o site lê pelo Prisma, no servidor, que não depende de RLS).
ALTER TABLE "VehicleVerifiedInfo" ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "VehicleVerifiedInfo" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;

-- Conferência: deve listar as 5 colunas (id, vehicleId, items, createdAt, updatedAt).
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'VehicleVerifiedInfo'
ORDER BY ordinal_position;
