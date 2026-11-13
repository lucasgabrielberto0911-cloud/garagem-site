#!/usr/bin/env bash
# Mostra quais PRs abertos mexem nos mesmos arquivos que você (ou nos caminhos que você passar).
# Serve para dois ou mais agentes (Claude Code, Antigravity, Cursor) não se misturarem. Veja AGENTS.md.
#
# Uso:
#   bash scripts/agentes-conflitos.sh                      # compara os arquivos da sua branch com os PRs abertos
#   bash scripts/agentes-conflitos.sh src/components/site  # ANTES de começar: quem já mexe nessa pasta/arquivo?
#
# Saída: 0 = ninguém mexe nos mesmos arquivos; 2 = há sobreposição (o aviso lista PR, branch e arquivos).
# Precisa de `gh` logado. Só lê: não altera nada.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v gh >/dev/null 2>&1; then
  echo "agentes-conflitos: o GitHub CLI (gh) não está instalado ou logado." >&2
  exit 1
fi

atual="$(git branch --show-current 2>/dev/null || true)"
meus="$(mktemp)"
prs="$(mktemp)"
trap 'rm -f "$meus" "$prs"' EXIT

if [ "$#" -gt 0 ]; then
  modo="caminhos"
  for caminho in "$@"; do printf '%s\n' "${caminho%/}" >> "$meus"; done
else
  modo="branch"
  git fetch origin main --quiet 2>/dev/null || true
  base="$(git merge-base origin/main HEAD 2>/dev/null || echo HEAD)"
  { git diff --name-only "$base"; git ls-files --others --exclude-standard; } | sort -u > "$meus"
  if [ ! -s "$meus" ]; then
    echo "agentes-conflitos: sua branch ainda não tem mudanças. Passe um caminho para consultar, por exemplo:"
    echo "  bash scripts/agentes-conflitos.sh src/components/site"
    exit 0
  fi
fi

gh pr list --state open --limit 100 --json number,title,headRefName,files \
  --jq '.[] | .number as $n | .headRefName as $b | .title as $t | .files[].path | "\($n)\t\($b)\t\($t)\t\(.)"' \
  | tr -d '\r' > "$prs"

achou=0
vistos=""
while IFS=$'\t' read -r numero ramo titulo arquivo; do
  [ -z "$numero" ] && continue
  [ "$ramo" = "$atual" ] && continue
  bate=0
  while IFS= read -r meu; do
    [ -z "$meu" ] && continue
    if [ "$arquivo" = "$meu" ]; then bate=1; break; fi
    if [ "$modo" = "caminhos" ] && [ "${arquivo#"$meu"/}" != "$arquivo" ]; then bate=1; break; fi
  done < "$meus"
  [ "$bate" -eq 0 ] && continue
  achou=1
  case " $vistos " in
    *" $numero "*) ;;
    *) printf '\nPR #%s (%s): %s\n' "$numero" "$ramo" "$titulo"; vistos="$vistos $numero" ;;
  esac
  printf '  - %s\n' "$arquivo"
done < "$prs"

if [ "$achou" -eq 0 ]; then
  echo "agentes-conflitos: nenhum PR aberto mexe nos mesmos arquivos. Pode seguir."
  exit 0
fi

echo
echo "agentes-conflitos: há sobreposição com PR aberto. Não edite esses arquivos sem combinar com o Lucas."
echo "Atualize também o quadro compartilhado (QUADRO-AGENTES.md)."
exit 2
