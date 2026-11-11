# Mapa de testes

Comandos oficiais (iguais ao CI): ver [`AGENTS.md`](../AGENTS.md).

```bash
npm test              # src/lib/*.test.ts
npm run lint
npm run build
npm run e2e:seed && npm run test:e2e   # exige banco local + E2E_TEST=1
```

Setup E2E detalhado: [`e2e/README.md`](../e2e/README.md).

## Testes unitários (`src/lib/*.test.ts`)

| Tema | Exemplos de arquivo (busque `*.test.ts`) |
| --- | --- |
| Slug e URL | `vehicle-slug.test.ts` |
| Estoque / filtros | `stock-query.test.ts`, `public-stock.test.ts` |
| Cache / revalidate | `public-stock-revalidate.test.ts` |
| SEO / feed Meta | arquivos `seo*.test.ts`, `catalog-feed*.test.ts` |
| Chat / busca vendedor | `chat-sales-search.test.ts`, `chat-*.test.ts` |
| Fotos / URLs | testes em `public-photo-url`, `r2` se existirem |
| Admin / vendas | `admin-*`, `vehicle-verified.test.ts` |

Rodar um arquivo:

```bash
npx tsx --test src/lib/public-stock-revalidate.test.ts
```

## E2E Playwright — por área

| Área | Specs |
| --- | --- |
| Ficha | `ficha-v2.spec.ts`, `ficha-itens.spec.ts`, `ficha-sobre-destaque.spec.ts`, `ficha-alinhamento.spec.ts`, `seo-fichas.spec.ts`, `sold-photo-paint.spec.ts` |
| Estoque / jornada | `estoque-abertura.spec.ts`, `estoque-carga-infinita.spec.ts`, `estoque-carroceria-cards.spec.ts`, `public-journeys.spec.ts`, `lote-site.spec.ts` |
| Conversão | `caminho-busca-ficha-whatsapp.spec.ts`, `favoritos-comparador.spec.ts`, `melhorias-conversao*.spec.ts` |
| Chat | `chat-ao-vivo.spec.ts`, `chat-mobile-polish.spec.ts`, `chat-research-journeys.spec.ts`, `chat-filtros-vendedor.spec.ts` |
| Fotos | `fotos-publicas.spec.ts`, `ordem-fotos-blob.spec.ts` |
| SEO / regional | `performance-seo-regional.spec.ts`, `seo-modelos-funil.spec.ts` |
| Admin geral | `admin-navegacao.spec.ts`, `admin-auditoria*.spec.ts` |
| Admin veículo | `admin-veiculo-wizard.spec.ts`, `admin-veiculo-edicao.spec.ts`, `admin-rascunhos-multiplos.spec.ts` |
| Admin vendas / leads | `admin-vendas-*.spec.ts`, `admin-leads-fluxo.spec.ts`, `admin-comercial.spec.ts`, `admin-compra.spec.ts` |
| Admin IA | `admin-ia.spec.ts` (mock NVIDIA no CI) |
| Links / 404 | `links.spec.ts`, `pagina-404.spec.ts` |

Rodar um spec:

```bash
npm run test:e2e -- e2e/ficha-v2.spec.ts
```

## CI (resumo)

- **unit:** test + lint + `tsc`
- **e2e:** Postgres 16, 4 shards, WebKit no shard 1
- **migrations:** aplica SQL de `supabase/migrations` duas vezes

## Depois de mudar…

| Você mexeu em… | Rode pelo menos… |
| --- | --- |
| `src/lib` com regra de negócio | `npm test` (+ teste novo se couber) |
| Home | `public-journeys` ou `lote-site` |
| Ficha pública | specs `ficha-*` / `seo-fichas` |
| Estoque / cards | `estoque-*` ou `public-journeys` |
| SEO global | `seo.test.ts`, `seo-fichas` |
| Feed Meta | `catalog-feed*.test.ts` |
| Admin veículo | `admin-veiculo-*` |
| Vendas / promissória | `admin-vendas-*` |
| Leads / pedido | `admin-leads-fluxo`, `pedido-compacto` |
| Compra (admin) | `admin-compra` |
| Chat | `chat-*.test.ts` + um e2e chat |
| Links / institucional | `links.spec.ts` |
| CSS global site | build + e2e de jornada (LCP indireto) |

Setup Playwright: [`E2E-PARA-IAS.md`](E2E-PARA-IAS.md).
