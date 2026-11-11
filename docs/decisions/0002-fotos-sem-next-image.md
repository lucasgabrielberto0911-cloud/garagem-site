# ADR 0002: Fotos de veículo sem `next/image` otimizado na Vercel

**Status:** aceito

## Contexto

A cota de Image Optimization do plano Hobby esgotou; religar quebra fotos (erro 402).

## Decisão

Manter `unoptimized: true` no Next; pipeline próprio em `/fotos/...` com `sharp` onde necessário e cache CDN documentado em `docs/ops.md`.

## Consequências

- PRs que “modernizam” para `next/image` exigem medição e plano de cota.
- Agentes não devem religar otimização por padrão.
