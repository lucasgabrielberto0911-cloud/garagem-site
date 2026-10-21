#!/usr/bin/env bash
# Aplica TODAS as migrations de supabase/migrations em ordem sobre um banco que já tem o schema do Prisma.
# Uso: DATABASE_URL=... scripts/ci-apply-migrations.sh   (banco descartável! nunca o de produção)
# Cria o mínimo do Supabase (papéis anon/authenticated e schema storage) se não existirem. Falha no primeiro erro.
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?defina DATABASE_URL}"
url=${DATABASE_URL%%\?*}
psql "$url" -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.objects (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public upload veiculos" ON storage.objects;
CREATE POLICY "Public upload veiculos" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'veiculos');
SQL
for f in supabase/migrations/*.sql; do
  echo "==> $f"
  psql "$url" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null
done
# Segunda passada: toda migration deve ser idempotente (exceto a que cria backup do rls: também é).
for f in supabase/migrations/*.sql; do psql "$url" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null; done
# Conferência: o script de leitura de produção deve achar todos os objetos (linhas `...|t`) e as consultas de
# RLS/grants/storage devem vir vazias; qualquer linha que não termine em `|t` é violação. Falha do psql derruba o script.
saida=$(psql "$url" -v ON_ERROR_STOP=1 -At -f scripts/check-migrations-prod.sql)
faltando=$(printf '%s\n' "$saida" | grep -v '^$' | grep -v '|t$' | head -20 || true)
[ -z "$faltando" ] || { echo "ERRO: objetos ausentes ou violações de RLS/grants/storage após as migrations:"; echo "$faltando"; exit 1; }
echo "OK: $(ls supabase/migrations/*.sql | wc -l) migrations aplicadas (2x)"
