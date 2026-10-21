-- Hardening de RLS (item 22 da análise de 21/10/2026). Idempotente e aditiva.
-- O Prisma conecta como `postgres` (dono das tabelas): ignora RLS sem FORCE. Por isso não usamos FORCE.
-- Nenhum código usa anon/authenticated para ler tabelas: a anon key só faz uploadToSignedUrl no Storage.
BEGIN;

-- 1) RLS em toda tabela do schema public que ainda não tem + 2) sem acesso para anon/authenticated.
DO $$
DECLARE
  t record;
  r text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', t.relname, r);
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

  DROP POLICY IF EXISTS "Public delete veiculos" ON storage.objects;
  DROP POLICY IF EXISTS "Public update veiculos" ON storage.objects;
  DROP POLICY IF EXISTS "Public upload veiculos" ON storage.objects;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Sem permissão em storage.objects: remova as 3 políticas "Public ... veiculos" pelo painel do Supabase.';
END $$;

COMMIT;
