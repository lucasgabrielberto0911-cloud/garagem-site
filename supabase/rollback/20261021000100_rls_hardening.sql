-- Rollback de 20261021000100_rls_hardening.sql.
-- Restaura só as tabelas que a migration alterou, com os grants anteriores de anon/authenticated
-- (registrados em public._rls_hardening_backup). Tabelas que já tinham RLS não são tocadas.
-- As políticas do storage removidas não são recriadas (eram abertas demais).
BEGIN;

DO $$
DECLARE
  t record;
  g record;
BEGIN
  IF to_regclass('public._rls_hardening_backup') IS NULL THEN
    RAISE NOTICE 'Sem backup do estado anterior: nada a restaurar.';
    RETURN;
  END IF;
  FOR t IN SELECT DISTINCT tabela FROM public._rls_hardening_backup LOOP
    IF to_regclass(format('public.%I', t.tabela)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.tabela);
      FOR g IN SELECT grantee, privilegio FROM public._rls_hardening_backup
               WHERE tabela = t.tabela AND grantee IS NOT NULL LOOP
        EXECUTE format('GRANT %s ON TABLE public.%I TO %I', g.privilegio, t.tabela, g.grantee);
      END LOOP;
    END IF;
  END LOOP;
  DROP TABLE public._rls_hardening_backup;
END $$;

COMMIT;
