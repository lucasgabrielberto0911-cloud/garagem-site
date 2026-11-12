# Área: painel — avaliação / compra de veículos

## Escopo

- UI e fluxo: `src/app/admin/compra/` (e rotas API `src/app/api/admin/compra/`)
- Integrações IA: Mistral / parecer (ver pesquisas recentes)
- Não confundir com **venda** ([`admin-vendas.md`](admin-vendas.md)) nem **cadastro de anúncio** ([`admin-veiculos.md`](admin-veiculos.md))

## Comportamento

1. Fluxo **privado** — sem reflexo direto no estoque público até publicar veículo.
2. Decisões de compra não devem alterar preços públicos existentes sem ação explícita.
3. Migrations SQL dedicadas podem existir em `supabase/migrations/` — seguir runbook de migrations.

## Consulta de placa

- Fonte principal: API `consultadeplaca.net` (`POST /api/v1/lookups`), chamada **só no servidor** em `src/lib/purchase-plate.ts`, com a chave em `CONSULTA_PLACA_API_KEY` (cabeçalho `Authorization: Bearer`, nunca na URL ou no navegador). Cobra por consulta concluída (R$ 0,07 em 2026-11; 20 grátis no cadastro; cache de 5 min por placa no servidor evita repetição).
- Só identidade e códigos FIPE são lidos. Cidade, UF, cor, roubo/furto e valores são descartados.
- Sem a chave, cai no `placafipe.com`, que bloqueia o servidor (403 Cloudflare); a tela mostra aviso e o preenchimento manual continua funcionando.
- Não tente contornar bloqueio de bot do provedor.

## Pesquisas

- [`docs/pesquisas/2026-11-10-avaliador-compra-entrega.md`](../pesquisas/2026-11-10-avaliador-compra-entrega.md)
- [`docs/pesquisas/2026-11-10-compra-rapida-mistral.md`](../pesquisas/2026-11-10-compra-rapida-mistral.md)

## Testes

- `e2e/admin-compra.spec.ts`

## Coordenação

Área costuma ser `admin` no `gh pr list` — combine com quem mexe em veículos/comercial.
