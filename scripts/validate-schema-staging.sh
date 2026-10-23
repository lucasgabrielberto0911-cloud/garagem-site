#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Prioridade para conexão no banco de staging: DIRECT_URL_STAGING > DATABASE_URL_STAGING > DIRECT_URL > DATABASE_URL
TARGET_URL="${DIRECT_URL_STAGING:-${DATABASE_URL_STAGING:-${DIRECT_URL:-${DATABASE_URL:-}}}}"

if [ -z "$TARGET_URL" ]; then
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::error::Secrets DATABASE_URL_STAGING ou DIRECT_URL_STAGING não encontradas."
    echo "Adicione DATABASE_URL_STAGING e DIRECT_URL_STAGING em GitHub Repo -> Settings -> Secrets and variables -> Actions."
    exit 1
  else
    echo "ERRO: Defina DATABASE_URL_STAGING, DIRECT_URL_STAGING ou DATABASE_URL para validar contra o banco de staging."
    exit 1
  fi
fi

# Assegura que DATABASE_URL e DIRECT_URL estejam preenchidas para que npx prisma validate
# não falhe por falta de variáveis no datasource do schema.prisma
export DATABASE_URL="${DATABASE_URL:-${DATABASE_URL_STAGING:-$TARGET_URL}}"
export DIRECT_URL="${DIRECT_URL:-${DIRECT_URL_STAGING:-$TARGET_URL}}"

echo "==> 1. Validando sintaxe do schema.prisma com prisma validate..."
npx prisma validate

echo "==> 2. Verificando drift entre schema.prisma e o banco de staging..."
DIFF_OUTPUT=""
DIFF_STATUS=0
DIFF_OUTPUT=$(npx prisma migrate diff \
  --exit-code \
  --from-url "$TARGET_URL" \
  --to-schema-datamodel prisma/schema.prisma 2>&1) || DIFF_STATUS=$?

if [ "$DIFF_STATUS" -eq 0 ]; then
  echo "OK: Schema do Prisma está 100% sincronizado com o banco de staging."
  exit 0
elif [ "$DIFF_STATUS" -eq 2 ]; then
  echo "::error::Drift detectado! O schema.prisma possui alterações que não foram aplicadas no banco de staging."
  echo ""
  echo "--- Resumo das diferenças encontradas ---"
  echo "$DIFF_OUTPUT"
  echo ""
  echo "--- SQL correspondente que precisa ser migrado no staging ---"
  npx prisma migrate diff \
    --from-url "$TARGET_URL" \
    --to-schema-datamodel prisma/schema.prisma \
    --script || true
  echo ""
  echo "ERRO: Aplique as migrations no banco de staging antes de mergear/deployar este PR."
  exit 2
else
  echo "::error::Erro ao conectar ao banco de staging ou executar diff do Prisma (exit code: $DIFF_STATUS):"
  echo "$DIFF_OUTPUT"
  exit "$DIFF_STATUS"
fi
