# Área: home e estoque (`/`, `/estoque`)

## Escopo

- Home: `src/app/(catalog)/page.tsx`
- Estoque: `src/app/(catalog)/estoque/page.tsx` e filtros/busca nos componentes `site`
- SEO marca/modelo: `src/app/(catalog)/marca/[slug]/`, `modelo/[slug]/`
- Dados: `src/lib/vehicles.ts`, `stock-query.ts`, `public-stock.ts`
- API JSON (se usar): `src/app/api/estoque/route.ts`

## Comportamento obrigatório

1. **Cards:** chips **pequenos** (ano, km, câmbio, carroceria…); foto e preço dominam.
2. **Mobile:** grade com **2 colunas** de carros (regra de negócio documentada no README).
3. **HTML inicial:** primeira leva de veículos no HTML (SEO e LCP) — mudanças aqui afetam Core Web Vitals.
4. **Vendido:** não listar como disponível; cards de disponíveis mostram preço.
5. **Busca/filtros:** cidade do veículo **não** é filtro público.

## Cache

- `revalidate = 3600` nas páginas do catálogo.
- Painel: `revalidatePublicStock()` invalida `/`, `/estoque`, tag e sitemap.

## Infinite scroll / API

Se alterar paginação ou `/api/estoque`, conferir:

- Consistência com filtros no servidor.
- e2e `estoque-carga-infinita.spec.ts`, `estoque-abertura.spec.ts`.

## Testes

- `e2e/estoque-*.spec.ts`, `public-journeys.spec.ts`, `estoque-carroceria-cards.spec.ts`
- Performance/regional: `performance-seo-regional.spec.ts`

## Erros comuns de IA

- Chips grandes demais no mobile.
- Carregar estoque só no cliente e esvaziar HTML inicial.
- Expor campo `city` do veículo na API pública.
