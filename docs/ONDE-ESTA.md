# Onde está? — índice para `rg`

Use `rg -n "termo" caminho` (ou o buscador do editor). Tabela de atalhos para tarefas comuns.

| Procurar… | Comece aqui |
| --- | --- |
| Preço / vendido sem preço | `src/app/(vehicle)/estoque/[id]/page.tsx`, `rg sold\|vendido src/components/site` |
| Slug e URL da ficha | `src/lib/vehicle-slug.ts` |
| Listagem e filtros do estoque | `src/app/(catalog)/estoque/`, `src/lib/stock-query.ts`, `src/lib/public-stock.ts` |
| Cache público do estoque | `src/lib/vehicles.ts`, `src/lib/public-stock-revalidate.ts` |
| Home e destaques | `src/app/(catalog)/page.tsx`, `src/lib/vehicles.ts` |
| JSON-LD / metadata SEO | `src/lib/seo.ts`, `rg JsonLd src` |
| Sitemap / robots | `src/app/sitemap.ts`, `src/app/robots.ts` |
| Feed Meta CSV | `src/lib/catalog-feed.ts`, `src/app/api/meta/catalog.csv/` (ver `areas/api-meta.md`) |
| Leads / pedido | `src/app/admin/leads/`, `(site)/pedido/`, `src/lib/leads.ts` |
| Home | `src/app/(catalog)/page.tsx` |
| CI / Vercel | `.github/workflows/ci.yml`, `vercel.json`, `scripts/vercel-ignore.sh` |
| Conflito entre agentes | `scripts/agentes-conflitos.sh`, `.agentes/em-andamento.md` |
| Loop para IAs | `docs/PRIMEIROS-PASSOS-IA.md`, `docs/runbooks/ambiente-agente.md` |
| URLs de fotos públicas | `src/lib/public-photo-url.ts`, `src/app/fotos/` |
| Upload / R2 | `src/lib/r2-photos.ts`, `src/app/api/upload/` |
| SEO metadata / JSON-LD | `src/lib/seo.ts`, `src/app/sitemap.ts`, `src/app/robots.ts` |
| Vendas no painel | `src/app/admin/vendas/actions.ts` |
| WhatsApp + pixel | `rg AddToCart src`, `src/components/site/` (CTAs ficha/card) |
| Chat assistente | `src/app/api/chat/`, `src/lib/chat-turn.ts`, `src/lib/chat-http.ts` |
| Login / sessão admin | `src/lib/auth.ts`, `src/app/admin/login/` |
| Salvar veículo no painel | `src/app/admin/veiculos/actions.ts` |
| Marcar venda | `src/app/admin/vendas/actions.ts`, `src/app/api/admin/vehicles/[id]/sell/` |
| Config do site (FAQ, links) | `src/app/admin/site/actions.ts`, `src/lib/site-settings.ts` |
| Consentimento / GA / Pixel | `src/components/CookieConsent.tsx`, `DeferredMarketing.tsx` |
| Tokens Tailwind / cores | `tailwind.config.ts`, `src/app/globals.css` |
| CSS só do admin | `src/app/admin/admin.css`, `tailwind.admin.config.ts` |
| Middleware / proxy admin | `src/proxy.ts` |
| Testes unitários de regra | `src/lib/*.test.ts` |
| E2E por tema | `e2e/ficha-*.spec.ts`, `e2e/estoque-*.spec.ts`, `e2e/admin-*.spec.ts` |
| CI | `.github/workflows/ci.yml` |
| Migrations SQL | `supabase/migrations/` |
| Schema Prisma | `prisma/schema.prisma` |

Guias por área: [`areas/README.md`](areas/README.md).
