# Área: api/meta — catálogo e campanhas

## Escopo

| Item | Caminho |
| --- | --- |
| Feed CSV | `src/app/api/meta/catalog.csv/route.ts`, alias `src/app/catalog/meta.csv/` |
| Montagem das linhas | `src/lib/catalog-feed.ts`, `catalog-feed-http.ts` |
| JPEG para a Meta | `src/app/api/catalog-jpg/` |
| Pixel / eventos no site | `DeferredMarketing`, componentes de WhatsApp — ver `docs/ops.md` |
| Env | `NEXT_PUBLIC_META_PIXEL_ID` |

## Comportamento obrigatório

1. Feed inclui só veículos **disponíveis** (status público).
2. `vehicle_id` no CSV = **CUID** Prisma = `content_ids` do Pixel (`content_type=vehicle`).
3. Rota do feed usa `dynamic = "force-dynamic"` mas resposta é cacheada na **CDN** (`s-maxage`) — não depende de `revalidatePublicStock` para o CSV.
4. Fotos no feed: JPEG (WebP convertido em rota dedicada).
5. Campanha atual otimiza **AddToCart** no clique WhatsApp — não remover sem plano (`ADR 0004`).

## Alteração segura

- Mudar colunas do CSV: conferir Commerce Manager e testes `catalog-feed*.test.ts`.
- Consignados: query param `?consigned=0` documentado em `ops.md`.
- Não alterar Pixel ID em código sem alinhar dataset no Commerce Manager.

## Testes

- Unitários: `src/lib/catalog-feed*.test.ts`
- Runbook: [`docs/runbooks/meta-catalog.md`](../runbooks/meta-catalog.md)

## Erros comuns de IA

- Ligar feed ao ISR de fichas (desnecessário).
- `content_ids` diferente do id do veículo no banco.
- Otimizar campanha para `Lead` no meio sem campanha nova.
