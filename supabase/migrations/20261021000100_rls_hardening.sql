-- Hardening de RLS (item 22 da análise de 21/10/2026). Idempotente e aditiva.
-- O Prisma conecta como `postgres` (dono das tabelas): ignora RLS sem FORCE. Por isso não usamos FORCE.
-- Nenhum código usa anon/authenticated para ler tabelas: a anon key só faz uploadToSignedUrl no Storage.
BEGIN;

-- 1) RLS em toda tabela do schema public que ainda não tem + 2) REVOKE ALL de anon/authenticated em TODAS as
-- tabelas e sequências de public (mesmo com RLS já ligado: em produção o anon ainda tinha GRANT SELECT).
-- Backup do estado anterior (usado só pelo rollback): uma linha-marcador por objeto (grantee nulo, com rls_antes)
-- + uma linha por privilégio de anon/authenticated. Já nasce com RLS e sem grants para anon/authenticated.
CREATE TABLE IF NOT EXISTS public._rls_hardening_backup (
  tabela text NOT NULL, tipo text NOT NULL DEFAULT 'table', rls_antes boolean, grantee text, privilegio text
);
ALTER TABLE public._rls_hardening_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public._rls_hardening_backup FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE public._rls_hardening_backup FROM %I', r);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  t record;
  r text;
  k text;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname, c.relkind, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'S') AND c.relname <> '_rls_hardening_backup'
  LOOP
    k := CASE WHEN t.relkind = 'S' THEN 'sequence' ELSE 'table' END;
    -- Só guarda na primeira execução: reexecutar não pode sobrescrever o estado original com o já revogado.
    IF NOT EXISTS (SELECT 1 FROM public._rls_hardening_backup b WHERE b.tabela = t.relname AND b.tipo = k) THEN
      INSERT INTO public._rls_hardening_backup (tabela, tipo, rls_antes)
      VALUES (t.relname, k, CASE WHEN t.relkind = 'S' THEN NULL ELSE t.relrowsecurity END);
      INSERT INTO public._rls_hardening_backup (tabela, tipo, grantee, privilegio)
      SELECT t.relname, k, g.rolname, a.privilege_type
      FROM pg_class c
      CROSS JOIN LATERAL aclexplode(c.relacl) a
      JOIN pg_roles g ON g.oid = a.grantee
      WHERE c.oid = t.oid AND g.rolname IN ('anon', 'authenticated');
    END IF;
    IF t.relkind <> 'S' AND NOT t.relrowsecurity THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON %s public.%I FROM %I',
                       CASE WHEN t.relkind = 'S' THEN 'SEQUENCE' ELSE 'TABLE' END, t.relname, r);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 3) Proteção do storage (de prisma/sql/admin-access-hardening.sql).
-- Leitura pública do bucket `veiculos` e uploads por URL assinada não dependem dessas políticas.
DO $$
DECLARE r text;
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM %I', r);
      END IF;
    END LOOP;
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
  END IF;
END $$;

-- Bloco separado: um insufficient_privilege aqui não pode desfazer os REVOKE acima.
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public delete veiculos" ON storage.objects;
  DROP POLICY IF EXISTS "Public update veiculos" ON storage.objects;
  DROP POLICY IF EXISTS "Public upload veiculos" ON storage.objects;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Sem permissão em storage.objects: remova as 3 políticas "Public ... veiculos" pelo painel do Supabase.';
END $$;

COMMIT;
