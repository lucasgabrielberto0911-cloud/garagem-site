# Área: painel — vendas, clientes e financeiro

## Escopo

| Tema | Rotas / arquivos |
| --- | --- |
| Lista e gestão de vendas | `src/app/admin/vendas/page.tsx`, `actions.ts` |
| Nova venda | `src/app/admin/vendas/nova/page.tsx` |
| Promissórias | `src/app/admin/promissorias/` |
| Clientes | `src/app/admin/clientes/` |
| Agenda / leads (cruzamento) | `src/app/admin/agenda/`, `leads/` |
| API auxiliar | `src/app/api/admin/vendas/`, `vehicles/[id]/sell/` |
| Dashboard | `src/app/admin/page.tsx`, `dashboard-actions.ts`, `admin-stats.ts` |

## Fluxo típico

1. Registrar venda → atualiza status do veículo (em geral **vendido**).
2. **`revalidatePublicStock(vehicleId)`** — ficha pública passa a sem preço e `noindex` conforme regra global.
3. Revalidação de rotas **admin** (`/admin/vendas`, `/admin`, veículo…) via `revalidatePath` nas actions — não substitui o helper público.
4. Promissória / cliente: dados **privados**; não vazar para API pública nem chat.

## Regras de negócio

- **Vendido no site = sem preço** em todos os canais — a venda no painel é o gatilho principal.
- Lucros, centavos, compra vinculada: regras já cobertas por testes admin e pesquisas; não arredondar ou “simplificar” valores em PR de UI.
- Exportações CSV: respeitar limites documentados no painel (não truncar silenciosamente).

## Cache admin

- Métricas e listagens: tag `admin-data` — `expireAdminData()` após mutações relevantes.
- Não confundir com cache público (`VEHICLES_PUBLIC_CACHE_TAG`).

## Testes

- E2E: `e2e/admin-vendas-promissorias.spec.ts`, `admin-vendas-recuperacao.spec.ts`, `admin-comercial.spec.ts`
- Pesquisa: `docs/pesquisas/2026-10-22-admin-vendas-causa-raiz.md`

## Erros comuns de IA

- Marcar vendido sem chamar `revalidatePublicStock`.
- Expor valor de venda ou cliente em JSON público / ficha.
- “Corrigir” venda histórica no banco via script em produção.

Área relacionada: [`admin-veiculos.md`](admin-veiculos.md) (estoque e publicação).
