# Runbook: catálogo Meta e pixel

## URLs do feed

- `https://www.suagaragem.net/api/meta/catalog.csv`
- Alias: `/catalog/meta.csv`
- Sem consignados: `?consigned=0`

## Checagens

1. Feed só veículos **disponíveis** (`catalog-feed.ts`).
2. `vehicle_id` = CUID Prisma = `content_ids` no site.
3. Pixel produção: `NEXT_PUBLIC_META_PIXEL_ID` (ver `.env.example` e `docs/ops.md`).
4. Commerce Manager: catálogo vertical Veículos; fonte agendada apontando para a URL do feed.
5. Fotos no feed: JPEG via `/api/catalog-jpg/...`.

## Sintomas comuns

| Sintoma | Onde olhar |
| --- | --- |
| Catálogo desatualizado | Cache CDN do CSV (não ISR); estoque no banco |
| Evento sem `content_ids` | CTA WhatsApp / componente de tracking |
| Imagem rejeitada na Meta | Formato JPEG, rota catalog-jpg |

IAs: não alterar ID do pixel nem URL de produção no Commerce Manager via código sem issue dedicada.
