# Área: SEO, sitemap e dados estruturados

## Escopo

| Tema | Onde |
| --- | --- |
| Helpers centrais | `src/lib/seo.ts` (`absoluteUrl`, metadata, JSON-LD loja/veículo) |
| Ficha | `generateMetadata` em `(vehicle)/estoque/[id]/page.tsx` |
| Landings estoque | `src/lib/stock-landings.ts`, `stock-landing-data.ts`, páginas `marca/` e `modelo/` |
| Regional | `/seminovos`, `/seminovos/[cidade]`, `/cidades` — `SERVICE_CITIES` em `seo.ts` |
| Guias de conteúdo | `src/lib/seo-guides.ts`, `buying-guides.ts` → rotas `/guia/`, `/guias/` |
| Sitemap | `src/app/sitemap.ts` (`revalidate = 300`) |
| Robots | `src/app/robots.ts` — bloqueia `/admin` e `/api`; libera crawlers de IA/Meta conforme lista |
| Componente | `src/components/JsonLd.tsx` |
| Slug canônico | `src/lib/vehicle-slug.ts` — canonical da ficha **deve** bater com o slug |

## Comportamento obrigatório

1. **Ficha disponível:** title/description, canonical, Open Graph, JSON-LD de veículo com oferta quando há preço.
2. **Ficha vendida:** título com "(vendido)", `noindex, follow`, JSON-LD **sem** preço em Offer.
3. **Sitemap:** responde **200**; inclui slugs de veículos indexáveis e rotas estáticas documentadas em `sitemap.ts`.
4. **robots.txt:** não bloquear `/estoque` nem fichas públicas.
5. **Região:** páginas `/cidades` e `/seminovos/*` falam da **área atendida pela loja** — não confundir com **cidade do veículo** (só admin).

## Cache

- Alteração de veículo no painel: `revalidatePublicStock()` também revalida `sitemap.xml`.
- Conteúdo editável (FAQ, textos): tag `site-settings` — invalidar nas actions de `admin/site`.

## Testes

- Unitário: `src/lib/seo.test.ts`
- E2E: `e2e/seo-fichas.spec.ts`, `e2e/seo-modelos-funil.spec.ts`, `e2e/performance-seo-regional.spec.ts`

## Pesquisas úteis

- `docs/pesquisas/2026-10-19-seo-fichas.md`
- `docs/pesquisas/2026-10-19-seo-modelos-medicao.md`

## Erros comuns de IA

- Canonical apontando para id antigo após mudar slug sem redirect.
- `noindex` em carro **disponível** “para testar”.
- Inventar URL de Maps ou sameAs sem dado em `site-settings` / env.
- Remover regras de bots (Meta, IA) em `robots.ts` sem combinar com Lucas.

Skill Claude (quando disponível): `nextjs-seo` para mudanças grandes em metadata/JSON-LD.
