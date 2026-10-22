#!/usr/bin/env bash
# Ignored Build Step da Vercel (garagem-site).
# exit 0 = pula o build; exit 1 = faz o build.
#
# Regras:
# - production / branch main → sempre builda
# - preview → builda se a mensagem do commit tiver `[preview]`
#   (caminho confiável, sem depender da API do GitHub) OU se o PR tiver
#   a label `preview` (consulta a API do GitHub, com GITHUB_TOKEN quando houver).

build() {
  echo "✅ Build: $1"
  exit 1
}

skip() {
  echo "⏭ Skip: $1"
  exit 0
}

ENV="${VERCEL_ENV:-}"
REF="${VERCEL_GIT_COMMIT_REF:-}"
MSG="${VERCEL_GIT_COMMIT_MESSAGE:-}"
PR_ID="${VERCEL_GIT_PULL_REQUEST_ID:-}"
REPO_OWNER="${VERCEL_GIT_REPO_OWNER:-lucasgabrielberto0911-cloud}"
REPO_SLUG="${VERCEL_GIT_REPO_SLUG:-garagem-site}"
API="${GITHUB_API_URL:-https://api.github.com}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

if [ "$ENV" = "production" ] || [ "$REF" = "main" ]; then
  build "produção/main (env=${ENV:-?} ref=${REF:-?})"
fi

# Caminho confiável: `[preview]` na mensagem do commit, sem tocar na API do GitHub.
case "$MSG" in
  *"[preview]"*) build "commit com [preview]" ;;
esac

# Opcional: label `preview` no PR. A API pública do GitHub limita/nega pedidos
# sem token, então a falha aqui nunca derruba o preview marcado com `[preview]`.
if [ -n "$PR_ID" ] && [ "$PR_ID" != "0" ]; then
  if [ -n "$TOKEN" ]; then
    LABELS="$(
      curl -fsS --max-time 8 \
        -H "Accept: application/vnd.github+json" \
        -H "User-Agent: garagem-vercel-ignore" \
        -H "Authorization: Bearer ${TOKEN}" \
        "${API}/repos/${REPO_OWNER}/${REPO_SLUG}/issues/${PR_ID}/labels" \
        2>/dev/null || true
    )"
  else
    LABELS="$(
      curl -fsS --max-time 8 \
        -H "Accept: application/vnd.github+json" \
        -H "User-Agent: garagem-vercel-ignore" \
        "${API}/repos/${REPO_OWNER}/${REPO_SLUG}/issues/${PR_ID}/labels" \
        2>/dev/null || true
    )"
  fi
  if printf '%s' "$LABELS" | grep -q '"name"[[:space:]]*:[[:space:]]*"preview"'; then
    build "PR #${PR_ID} com label preview"
  fi
fi

skip "preview sem [preview] no commit e sem label preview (env=${ENV:-?} ref=${REF:-?})"
