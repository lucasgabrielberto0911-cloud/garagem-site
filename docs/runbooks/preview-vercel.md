# Runbook: preview na Vercel

## Quando usar

PR pronto para teste visual final no deploy preview (não em todo push).

## Passos

1. Local verde: `npm test`, `npm run lint`, `npm run build`.
2. No PR: adicionar label GitHub **`preview`** **ou** commit com **`[preview]`** na mensagem.
3. Aguardar deploy (produção na `main` sempre builda; preview pode ser ignorado por `scripts/vercel-ignore.sh` até o passo 2).
4. Testar URLs do preview: home, estoque, ficha, admin se o PR mexer no painel.
5. Fotos: não validar baixando produção; no preview use dados do ambiente do PR.
6. Medição pública (Lighthouse): Chrome DevTools ou skill de performance no preview — ver metas no `AGENTS.md`.

## Economia

Hobby ~100 deploys/dia — não marcar preview em pushes intermediários.
