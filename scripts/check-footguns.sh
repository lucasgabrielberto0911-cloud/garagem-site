#!/usr/bin/env bash
# Padrões proibidos documentados em AGENTS.md e docs/ANTI-PATTERNS.md
set -euo pipefail
cd "$(dirname "$0")/.."
erro=0

PATTERN='revalidatePath\("/estoque/\[id\]", "page"\)'
ALLOWED_FILE="src/lib/public-stock-revalidate.ts"

while IFS= read -r file; do
  [ -z "$file" ] && continue
  if [ "$file" != "$ALLOWED_FILE" ]; then
    echo "ERRO: $PATTERN só é permitido em $ALLOWED_FILE (encontrado em $file)"
    rg -n "$PATTERN" "$file" || true
    erro=1
  fi
done < <(rg -l "$PATTERN" src 2>/dev/null || true)

if [ -f "$ALLOWED_FILE" ]; then
  # Ignora menções em comentários; só conta chamada de código (indentada).
  count=$(rg -n "$PATTERN" "$ALLOWED_FILE" 2>/dev/null | rg -c ':[[:space:]]+revalidatePath' || true)
  count=${count:-0}
  if [ "$count" -ne 1 ]; then
    echo "ERRO: esperada 1 chamada de $PATTERN em $ALLOWED_FILE (revalidateAllPublicFichas), achou: $count"
    erro=1
  fi
fi

if [ "$erro" -ne 0 ]; then
  echo "Falha em scripts/check-footguns.sh"
  exit 1
fi

echo "check-footguns: ok"
