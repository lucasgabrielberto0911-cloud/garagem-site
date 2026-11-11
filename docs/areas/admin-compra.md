# Área: painel — avaliação / compra de veículos

## Escopo

- UI e fluxo: `src/app/admin/compra/` (e rotas API `src/app/api/admin/compra/`)
- Integrações IA: Mistral / parecer (ver pesquisas recentes)
- Não confundir com **venda** ([`admin-vendas.md`](admin-vendas.md)) nem **cadastro de anúncio** ([`admin-veiculos.md`](admin-veiculos.md))

## Comportamento

1. Fluxo **privado** — sem reflexo direto no estoque público até publicar veículo.
2. Decisões de compra não devem alterar preços públicos existentes sem ação explícita.
3. Migrations SQL dedicadas podem existir em `supabase/migrations/` — seguir runbook de migrations.

## Pesquisas

- [`docs/pesquisas/2026-11-10-avaliador-compra-entrega.md`](../pesquisas/2026-11-10-avaliador-compra-entrega.md)
- [`docs/pesquisas/2026-11-10-compra-rapida-mistral.md`](../pesquisas/2026-11-10-compra-rapida-mistral.md)

## Testes

- `e2e/admin-compra.spec.ts`

## Coordenação

Área costuma ser `admin` no `gh pr list` — combine com quem mexe em veículos/comercial.
