#!/usr/bin/env bash
# Valida nomes e rollbacks de supabase/migrations. Uso: scripts/check-migrations.sh [ref-base]
# Nome: AAAAMMDDHHMMSS_slug_em_snake_case.sql. Arquivo NOVO (vs. ref-base) destrutivo exige supabase/rollback/<mesmo nome>.
# Sem rollback: erro se a migration for nova e destrutiva (DROP TABLE/COLUMN/SCHEMA, TRUNCATE, DELETE FROM, REVOKE), aviso nos demais casos novos.
set -u
cd "$(dirname "$0")/.."
base="${1:-}"
erro=0
novos=""
if [ -n "$base" ]; then
  novos=$(git diff --name-only --diff-filter=A "$base" -- supabase/migrations) || { echo "ERRO: git diff falhou para a referência-base: $base"; exit 2; }
fi
anterior=""
for f in supabase/migrations/*; do
  n=$(basename "$f")
  if ! [[ "$n" =~ ^[0-9]{14}_[a-z0-9]+(_[a-z0-9]+)*\.sql$ ]]; then
    echo "ERRO: nome fora do padrão AAAAMMDDHHMMSS_slug.sql: $n"; erro=1; continue
  fi
  v=${n%%_*}
  if [ "$v" = "$anterior" ]; then echo "ERRO: versão duplicada: $v"; erro=1; fi
  anterior=$v
  if grep -qxF "$f" <<<"$novos"; then
    if grep -qiE '^\s*(DROP (TABLE|SCHEMA)|TRUNCATE|DELETE FROM|REVOKE)|\bDROP COLUMN\b' "$f" \
      && [ ! -f "supabase/rollback/$n" ]; then
      echo "ERRO: migration nova destrutiva sem supabase/rollback/$n"; erro=1
    elif [ ! -f "supabase/rollback/$n" ]; then
      echo "AVISO: migration nova sem rollback (supabase/rollback/$n)"
    fi
  fi
done
exit $erro
