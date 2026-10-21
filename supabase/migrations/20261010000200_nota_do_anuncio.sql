-- Nota do anúncio pelo Jev, gravada no Salvar do admin.
-- Idempotente: pode rodar mais de uma vez. Só cria uma tabela nova e opcional;
-- não altera "Vehicle" nem nenhum dado. Sem esta tabela o admin salva normal,
-- só não grava nem mostra a nota.

CREATE TABLE IF NOT EXISTS "VehicleListingScore" (
  "id" TEXT PRIMARY KEY,
  "vehicleId" TEXT NOT NULL,
  "judgment" JSONB NOT NULL,
  "inputHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehicleListingScore_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "VehicleListingScore_vehicleId_key" ON "VehicleListingScore"("vehicleId");

-- Mesmo padrão das outras tabelas: sem acesso pela API pública do Supabase.
ALTER TABLE "VehicleListingScore" ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "VehicleListingScore" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;

-- Conferência: deve listar as 6 colunas.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'VehicleListingScore'
ORDER BY ordinal_position;
