-- Revisar antes de publicar: o site usa Prisma no servidor para Vehicle/Photo/LeadVenda.
-- URLs públicas de fotos continuam funcionando. Uploads usam o servidor ou URL assinada.
-- Não executado em produção nesta implementação.
BEGIN;
ALTER TABLE "Vehicle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Photo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadVenda" ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "Vehicle", "Photo", "LeadVenda" FROM %I', role_name);
      IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM %I', role_name);
      END IF;
    END IF;
  END LOOP;
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
  END IF;
END $$;
-- Estas políticas foram identificadas na conferência autorizada de 02/10/2026.
DROP POLICY IF EXISTS "Public delete veiculos" ON storage.objects;
DROP POLICY IF EXISTS "Public update veiculos" ON storage.objects;
DROP POLICY IF EXISTS "Public upload veiculos" ON storage.objects;
COMMIT;
