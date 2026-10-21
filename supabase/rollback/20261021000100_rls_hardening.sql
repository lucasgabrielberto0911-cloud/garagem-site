-- Rollback de 20261021000100_rls_hardening.sql.
-- Cobre as 7 tabelas que estavam sem RLS na análise de 21/10/2026. Se a verificação pré-aplicação
-- listar outras, acrescente-as aqui. As políticas do storage removidas não são recriadas (eram abertas demais).
BEGIN;

DO $$
DECLARE
  t text;
  r text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Admin', 'Customer', 'Sale', 'VehicleCost', 'VehicleDocument', 'Testimonial', 'SiteSettings'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
      FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
          EXECUTE format('GRANT ALL ON TABLE public.%I TO %I', t, r);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

COMMIT;
