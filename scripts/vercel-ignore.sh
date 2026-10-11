#!/usr/bin/env bash
# Ignored Build Step da Vercel (garagem-site).
# exit 0 = pula o build; exit 1 = faz o build.
#
# Regras:
# - production / branch main → sempre builda
# - preview → só se o PR tiver a label `preview` OU a mensagem
#   do commit tiver `[preview]`

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

if [ "$ENV" = "production" ] || [ "$REF" = "main" ]; then
  build "produção/main (env=${ENV:-?} ref=${REF:-?})"
fi

case "$MSG" in
  *"[preview]"*) build "commit com [preview]" ;;
esac

if [ -n "$PR_ID" ] && [ "$PR_ID" != "0" ]; then
  LABELS="$(
    curl -fsS --max-time 8 \
      -H "Accept: application/vnd.github+json" \
      -H "User-Agent: garagem-vercel-ignore" \
      "https://api.github.com/repos/lucasgabrielberto0911-cloud/garagem-site/issues/${PR_ID}/labels" \
      2>/dev/null || true
  )"
  if printf '%s' "$LABELS" | grep -q '"name"[[:space:]]*:[[:space:]]*"preview"'; then
    build "PR #${PR_ID} com label preview"
  fi
fi

skip "preview sem label preview e sem [preview] no commit (env=${ENV:-?} ref=${REF:-?})"
