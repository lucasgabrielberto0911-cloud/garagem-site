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
    # varredura única: comentários "--" e /* */ (aninhados) viram espaço, literais '...', E'...' (com \\) e "..." viram vazios (respeita '' e ""); dollar-quoted ($$..$$, $tag$..$tag$) mantém o corpo (DO/função continua varrido), normalizado recursivamente (comentários dentro dele também viram espaço);
    # depois normaliza quebras/espaços para a detecção não depender da formatação
    if perl -0e 'sub n { my $t = shift; $t =~ s{(/\*(?:[^/*]++|/(?!\*)|\*(?!/)|(?1))*+\*/)|--[^\n]*|(\$(?:[A-Za-z_]\w*)?\$)(.*?)\2|\b[eE]\x27(?:[^\x27\\]|\\.|\x27\x27)*\x27|\x27(?:[^\x27]|\x27\x27)*\x27|"(?:[^"]|"")*"}{defined $2 ? $2 . n($3) . $2 : defined $1 || substr($&,0,1) eq "-" ? " " : substr($&,0,1) x 2}gse; $t } print n(<>)' "$f" | tr '\r\n\t' '   ' | tr -s ' ' | grep -qiP '(^|;|\b(BEGIN|THEN|ELSE|LOOP)) ?(DROP (TABLE|SCHEMA)|TRUNCATE|REVOKE)|\bDELETE FROM\b|\bALTER TABLE\b[^;]*\bDROP (?!(CONSTRAINT|DEFAULT|NOT NULL|IDENTITY|EXPRESSION)\b)' \
      && [ ! -f "supabase/rollback/$n" ]; then
      echo "ERRO: migration nova destrutiva sem supabase/rollback/$n"; erro=1
    elif [ ! -f "supabase/rollback/$n" ]; then
      echo "AVISO: migration nova sem rollback (supabase/rollback/$n)"
    fi
  fi
done
exit $erro
