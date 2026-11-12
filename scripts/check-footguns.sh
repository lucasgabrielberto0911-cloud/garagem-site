#!/usr/bin/env bash
# Padrões proibidos documentados em AGENTS.md e docs/ANTI-PATTERNS.md
# Usa GNU grep (presente no runner do GitHub). Não depende de ripgrep (`rg`).
set -euo pipefail
cd "$(dirname "$0")/.."
erro=0

NEEDLE='revalidatePath("/estoque/[id]", "page")'
ALLOWED_FILE="src/lib/public-stock-revalidate.ts"

while IFS= read -r file; do
  [ -z "$file" ] && continue
  if [ "$file" != "$ALLOWED_FILE" ]; then
    echo "ERRO: $NEEDLE só é permitido em $ALLOWED_FILE (encontrado em $file)"
    grep -Fn -- "$NEEDLE" "$file" || true
    erro=1
  fi
done < <(grep -FRl --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' -- "$NEEDLE" src 2>/dev/null || true)

if [ -f "$ALLOWED_FILE" ]; then
  # Ignora menções em comentários; só conta chamada de código (indentada).
  count=$(grep -Fn -- "$NEEDLE" "$ALLOWED_FILE" | grep -cE '^[[:digit:]]+:[[:space:]]+revalidatePath' || true)
  count=${count:-0}
  if [ "$count" -ne 1 ]; then
    echo "ERRO: esperada 1 chamada de $NEEDLE em $ALLOWED_FILE (revalidateAllPublicFichas), achou: $count"
    erro=1
  fi
fi

if [ "$erro" -ne 0 ]; then
  echo "Falha em scripts/check-footguns.sh"
  exit 1
fi

echo "check-footguns: ok"
