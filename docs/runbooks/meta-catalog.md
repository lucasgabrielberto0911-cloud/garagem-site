# Runbook: catálogo Meta e pixel

## URLs do feed

- `https://www.suagaragem.net/api/meta/catalog.csv`
- Alias: `/catalog/meta.csv`
- Consignado **nunca** entra (decisão do Lucas, 15/11/2026). Não existe parâmetro que reative: `?consigned=` é ignorado.

## Checagens

1. Feed só veículos **próprios** e **disponíveis**, não históricos (`catalog-feed-query.ts`). Carros e motos entram.
2. `vehicle_id` = CUID Prisma = `content_ids` no site.
3. Pixel produção: `NEXT_PUBLIC_META_PIXEL_ID` (ver `.env.example` e `docs/ops.md`).
4. Commerce Manager: catálogo vertical Veículos; fonte agendada apontando para a URL do feed.
5. Fotos no feed: JPEG via `/api/catalog-jpg/...`.

## Sintomas comuns

| Sintoma | Onde olhar |
| --- | --- |
| Próprio disponível fora do feed | Só sai se for consignado (nunca entra) ou se não tiver foto pública servível: o feed exige foto no Blob da loja ou no R2 (`isPublicPhotoSource`). Foto só no Storage do Supabase é recusada de propósito (egress) |
| Catálogo desatualizado | Cache CDN do CSV (não ISR); estoque no banco |
| Evento sem `content_ids` | CTA WhatsApp / componente de tracking |
| Imagem rejeitada na Meta | Formato JPEG, rota catalog-jpg |

IAs: não alterar ID do pixel nem URL de produção no Commerce Manager via código sem issue dedicada.
