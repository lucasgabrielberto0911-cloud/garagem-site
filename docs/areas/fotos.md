# Área: fotos públicas e pipeline de imagem

## Escopo

- URLs: `src/lib/public-photo-url.ts`
- Entrega: `src/app/fotos/[...path]/route.ts` e rotas em `src/app/api/fotos/`, `catalog-jpg`, `foto-jpg`
- Upload admin: `src/app/api/upload/*`, `r2-photos.ts`, legado Supabase Storage
- Ops: **[`docs/ops.md`](../ops.md)** (seção Image Optimization)

## Regras

1. **Egress:** agentes não baixam fotos de produção nem do Storage (ver AGENTS.md).
2. **Vercel:** `next/image` otimizado desligado (`unoptimized: true`) por cota Hobby.
3. **Variantes:** cards `-card.webp`; ampliada `1280-contain-q78`; Meta usa JPEG dedicado.
4. **Cache CDN:** cópias versionadas vs cards sem `immutable` (backfill regrava).

## R2 vs Supabase

- Fotos **novas** tendem a R2 (`R2_*` env).
- Legado ainda pode apontar para Supabase; não unificar em um PR gigante sem plano.

## Testes

- `e2e/fotos-publicas.spec.ts`, `sold-photo-paint.spec.ts`, `ordem-fotos-blob.spec.ts`
- E2E usa `placeholder-car.png` para requests de foto (servidor + `page.route`).

## Pesquisas relacionadas

- `docs/pesquisas/2026-11-02-egress-storage-fotos.md`
- `docs/pesquisas/2026-11-09-verificacao-fotos-estoque.md`

## Erros comuns de IA

- Migrar tudo para `next/image` “por performance”.
- Script que percorre bucket de produção.
- `immutable` em path que o backfill reescreve.
