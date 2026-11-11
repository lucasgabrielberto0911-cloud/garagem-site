# Área: home (`/`)

## Escopo

- Página: `src/app/(catalog)/page.tsx` (grupo `(catalog)`, **não** confundir com `(site)`)
- Componentes típicos: `HeroSearch`, `VehicleGrid`, `StatsBar`, `Testimonials`, `HomeAssistantCta`, `SiteWordmark`
- SEO: `buildPageMetadata`, JSON-LD (`localBusinessJsonLd`, `websiteJsonLd`, `itemListJsonLd`) via `seo.ts`
- Dados: `vehicles.ts` (destaques / listas em cache)

## Comportamento obrigatório

1. **LCP / primeira pintura:** evitar JS bloqueante desnecessário; HTML inicial deve trazer valor (busca, primeiros veículos quando o design pedir).
2. **revalidate = 3600** — mudanças no painel exigem `revalidatePublicStock()` / invalidação de conteúdo (`site-settings`).
3. **Marca:** logo `SiteWordmark` estável; tokens `asphalt`, `cream`, `brand`.
4. **WhatsApp** da loja: mensagens de `WHATSAPP_MESSAGES` / `site.ts` — não inventar número.

## Diferença home × estoque

| | Home | Estoque |
| --- | --- | --- |
| Rota | `/` | `/estoque` |
| Foco | Conversão, confiança, destaques | Filtros, busca, grade completa |
| Guia | Este arquivo | [`estoque.md`](estoque.md) |

## Testes

- `e2e/public-journeys.spec.ts`, `lote-site.spec.ts`, `centralizacao-site.spec.ts`
- Performance indireta: build + e2e; medição formal: Lighthouse no preview (`AGENTS.md`)

## Erros comuns de IA

- Mover lógica pesada para client sem medir LCP.
- Trocar wordmark ou paleta “para modernizar”.
- Esvaziar veículos do HTML inicial só por “simplificar”.
