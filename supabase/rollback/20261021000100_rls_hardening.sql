-- Rollback de 20261021000100_rls_hardening.sql.
-- Restaura exatamente o estado guardado em public._rls_hardening_backup: RLS como estava (desliga só onde
-- estava desligado) e os grants de anon/authenticated em tabelas e sequências.
-- As políticas do storage removidas não são recriadas (eram abertas demais).
BEGIN;

DO $$
DECLARE
  t record;
  g record;
  r text;
  obj text;
BEGIN
  IF to_regclass('public._rls_hardening_backup') IS NULL THEN
    RAISE NOTICE 'Sem backup do estado anterior: nada a restaurar.';
    RETURN;
  END IF;
  FOR t IN SELECT tabela, tipo, rls_antes FROM public._rls_hardening_backup WHERE grantee IS NULL LOOP
    obj := CASE WHEN t.tipo = 'sequence' THEN 'SEQUENCE' ELSE 'TABLE' END;
    IF to_regclass(format('public.%I', t.tabela)) IS NULL THEN CONTINUE; END IF;
    IF t.tipo = 'table' AND t.rls_antes IS FALSE THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.tabela);
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON %s public.%I FROM %I', obj, t.tabela, r);
      END IF;
    END LOOP;
    FOR g IN SELECT grantee, privilegio FROM public._rls_hardening_backup
             WHERE tabela = t.tabela AND tipo = t.tipo AND grantee IS NOT NULL LOOP
      EXECUTE format('GRANT %s ON %s public.%I TO %I', g.privilegio, obj, t.tabela, g.grantee);
    END LOOP;
  END LOOP;
  DROP TABLE public._rls_hardening_backup;
END $$;

COMMIT;
