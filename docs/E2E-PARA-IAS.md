# E2E para agentes (Playwright)

Resumo para IAs. Detalhes completos: [`e2e/README.md`](../e2e/README.md).

## Quando rodar

| Mudou… | Rode |
| --- | --- |
| Ficha | `e2e/ficha-v2.spec.ts` (ou specs `ficha-*`) |
| Estoque / cards | `e2e/estoque-*.spec.ts`, `public-journeys.spec.ts` |
| Home | `public-journeys.spec.ts`, `lote-site.spec.ts` |
| Chat | `e2e/chat-ao-vivo.spec.ts` + testes `src/lib/chat-*.test.ts` |
| SEO | `seo-fichas.spec.ts` |
| Admin | spec `admin-*` da área (ver [`TESTES.md`](TESTES.md)) |

Mexeu em tela pública sem spec óbvio: pelo menos um percurso de [`public-journeys.spec.ts`](../e2e/public-journeys.spec.ts).

## Setup mínimo

```bash
cp .env.example .env    # banco LOCAL
export E2E_TEST=1
npm ci && npx prisma generate && npm run db:push
npm run e2e:seed
npm run build
npx playwright install chromium
npm run test:e2e
```

Banco: **localhost**, nome `ci` ou `garagem_e2e` — nunca produção.

## Fotos no E2E

Use `stubPageFotos(page)` de `e2e/stub-fotos.ts` (fixture `public/branding/placeholder-car.png`). Cobre `/fotos`, `/api/fotos`, `/api/catalog-jpg`, Storage do Supabase e Blob. Não copie `page.route("**/fotos/**")` em spec nova. Servidor Node também usa fixture com `E2E_TEST=1`.

## Viewports

CI cobre **320, 390, 430 e 1440 px**. Regressão de layout mobile é critério de merge em mudanças de UI.

## O que não fazer

- Baixar fotos reais do site em produção para “validar”.
- Desabilitar assert de erro JS/hidratação para “passar verde”.
- Rodar e2e contra `DATABASE_URL` de produção.

## Editar specs

Arquivos em `e2e/*.spec.ts`. Ao adicionar fluxo novo, nome descritivo em kebab-case e menção no [`TESTES.md`](TESTES.md).

Regra Cursor ao editar `e2e/`: [`.cursor/rules/area-e2e.mdc`](../.cursor/rules/area-e2e.mdc).
