# Glossário — Garagem (código e negócio)

Termos usados no repositório, no painel e nas conversas com IAs. Em dúvida, o comportamento do **código em produção** vence a intuição.

| Termo | Significado |
| --- | --- |
| **Garagem** | Nome da marca visível. Não criar texto novo com "Sua Garagem". |
| **CUID** | Id do veículo no Prisma (`Vehicle.id`). Usado em URLs internas, `content_ids` do Pixel Meta e coluna `vehicle_id` do feed CSV. |
| **Slug canônico** | Caminho público `/estoque/{marca-modelo-ano}-{cuid}` montado em `vehicle-slug.ts`. Mudar marca/modelo/ano pode mudar o slug — revalidar URL antiga via `revalidatePublicStock(..., previous)`. |
| **disponivel** | Status de veículo no estoque público (catálogo, ficha indexável, feed Meta). |
| **vendido** | Sem preço em lugar nenhum no site; ficha com `(vendido)`, `noindex, follow`; JSON-LD sem Offer com preço. |
| **histórico** | Veículo fora do estoque ativo (não entra na listagem pública como disponível). |
| **Consignado** | Conceito interno/admin. **Não** aparece para o cliente no site. |
| **Rascunho (admin)** | Veículo ou cadastro ainda não publicado; não deve vazar para cache público sem ação explícita. |
| **VEHICLES_PUBLIC_CACHE_TAG** | Tag `unstable_cache` do estoque público (`vehicles.ts`). TTL 3600 s. |
| **site-settings** | Tag de cache de textos/config da loja (FAQ, depoimentos, ajustes do site). |
| **admin-data** | Tag de cache de listagens e métricas do painel. |
| **revalidatePublicStock()** | Invalidação correta após mudança no painel: tag, home, `/estoque`, sitemap, uma ficha por slug. |
| **ISR / revalidate = 3600** | Páginas públicas podem servir HTML cacheado até 1 h se o painel não invalidar. |
| **Fixture de foto** | `public/branding/placeholder-car.png` em testes/e2e — substitui URLs `/fotos/**` sem egress. |
| **Master (foto)** | Arquivo privado alta resolução no bucket `documentos`; download só admin autenticado. |
| **Variante -card.webp** | Tamanho de card (~480×360); cache longo na CDN; backfill pode regravar o mesmo caminho. |
| **AddToCart / Lead** | Eventos Meta no WhatsApp da ficha; `content_ids` = CUID, `content_type=vehicle`. Campanha atual otimiza AddToCart. |
| **Feed Meta** | `/api/meta/catalog.csv` — só disponíveis; cache CDN, não ISR. |
| **Server Action** | Função `"use server"` em `actions.ts` do App Router; único lugar para `updateTag` no estoque público. |
| **Região atendida / cidades** | Páginas e textos de área comercial (ex. `/cidades`). **Não** confundir com cidade do veículo (só admin). |
| **Jev / nota do anúncio** | IA opcional no admin (`JEV_API_KEY`); não trava salvamento se ausente. |
| **Grok Bot** | Coordenador humano/bot que revisa CI/preview e faz merge; agentes não mergeiam na `main`. |
| **Antigravity** | Agente Gemini local; branch `agy/<tema>`; regra 10 do `AGENTS.md`. |
| **agentes-conflitos.sh** | Script que lista PRs abertos que tocam o mesmo caminho (`npm run agentes:conflitos`). Saída 2 = sobreposição. |

Ver também: [`ANTI-PATTERNS.md`](ANTI-PATTERNS.md), [`GUIA-PARA-IAS-E-DESENVOLVEDORES.md`](GUIA-PARA-IAS-E-DESENVOLVEDORES.md).
