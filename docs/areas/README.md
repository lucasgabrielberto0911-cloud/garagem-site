# Guias por área do produto

Leia o guia da área **antes** de codar. Regras globais continuam em [`AGENTS.md`](../../AGENTS.md).

| Área | Guia | E2E principal |
| --- | --- | --- |
| Ficha do veículo | [`ficha.md`](ficha.md) | `ficha-v2.spec.ts`, `seo-fichas.spec.ts`, `sold-photo-paint.spec.ts` |
| Estoque / home catálogo | [`estoque.md`](estoque.md) | `estoque-*.spec.ts`, `public-journeys.spec.ts` |
| Admin veículos / fotos | [`admin-veiculos.md`](admin-veiculos.md) | `admin-veiculo-*.spec.ts`, `ordem-fotos-blob.spec.ts` |
| Chat | [`chat.md`](chat.md) | `chat-*.spec.ts`, `src/lib/chat-*.test.ts` |
| Fotos públicas | [`fotos.md`](fotos.md) | `fotos-publicas.spec.ts`, `docs/ops.md` |
| SEO / sitemap | [`seo.md`](seo.md) | `seo-fichas.spec.ts`, `seo.test.ts` |
| Admin vendas / clientes | [`admin-vendas.md`](admin-vendas.md) | `admin-vendas-*.spec.ts` |

Coordenação: não abrir PR na mesma área que outro agente (`gh pr list`).
