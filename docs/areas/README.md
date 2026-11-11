# Guias por área do produto

Leia o guia da área **antes** de codar. Regras globais: [`AGENTS.md`](../../AGENTS.md). Índice geral: [`docs/README.md`](../README.md).

| Área (label) | Guia | E2E / testes principais |
| --- | --- | --- |
| `home` | [`home.md`](home.md) | `public-journeys.spec.ts`, `lote-site.spec.ts` |
| `estoque` | [`estoque.md`](estoque.md) | `estoque-*.spec.ts` |
| `ficha` | [`ficha.md`](ficha.md) | `ficha-v2.spec.ts`, `seo-fichas.spec.ts`, `sold-photo-paint.spec.ts` |
| `seo` | [`seo.md`](seo.md) | `seo-fichas.spec.ts`, `seo.test.ts` |
| `chat` | [`chat.md`](chat.md) | `chat-*.spec.ts`, `chat-*.test.ts` |
| `api/meta` | [`api-meta.md`](api-meta.md) | `catalog-feed*.test.ts` |
| institucional | [`site-institucional.md`](site-institucional.md) | `links.spec.ts`, `pedido-compacto.spec.ts` |
| `admin` veículos | [`admin-veiculos.md`](admin-veiculos.md) | `admin-veiculo-*.spec.ts` |
| `admin` vendas | [`admin-vendas.md`](admin-vendas.md) | `admin-vendas-*.spec.ts` |
| `admin` leads | [`admin-leads.md`](admin-leads.md) | `admin-leads-fluxo.spec.ts` |
| `admin` compra | [`admin-compra.md`](admin-compra.md) | `admin-compra.spec.ts` |
| fotos | [`fotos.md`](fotos.md) | `fotos-publicas.spec.ts` |
| `infra` | [`infra.md`](infra.md) | CI local (`npm test` / `build`) |

Coordenação: `gh pr list` — não duplicar área com PR aberto.
