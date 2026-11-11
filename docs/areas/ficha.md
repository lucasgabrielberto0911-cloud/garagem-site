# Área: ficha do veículo (`/estoque/[id]`)

## Escopo

- Rota: `src/app/(vehicle)/estoque/[id]/page.tsx`
- Layout: `src/app/(vehicle)/layout.tsx` (herda shell do site)
- Componentes: `src/components/site/` (galeria, preço, WhatsApp, chips, parecidos…)
- Slug: `src/lib/vehicle-slug.ts` — redirects se URL antiga

## Comportamento obrigatório

1. **Vendido:** HTTP 200, título com "(vendido)", `noindex, follow`, **sem preço** em UI, JSON-LD e mensagem WhatsApp.
2. **Disponível:** metadata completa, canonical = slug, JSON-LD de veículo/oferta **com** preço quando aplicável.
3. **Cidade do veículo:** não exibir no público (nem em specs visíveis ao cliente).
4. **WhatsApp:** CTA principal; eventos Meta `AddToCart` e `Lead` com `content_ids` = id Prisma.
5. **Fotos:** URLs via `public-photo-url.ts`; zoom sob demanda; não trocar para `next/image` sem medir.

## Cache

- Página: `revalidate = 3600`.
- Após editar no painel: `revalidatePublicStock(vehicleId, { previous })` — **não** `revalidatePath("/estoque/[id]", "page")` em massa.

## Arquivos que costumam mudar juntos

| Mudança | Arquivos típicos |
| --- | --- |
| Layout / ordem das seções | `page.tsx`, componentes em `components/site/` |
| SEO / compartilhamento | `seo.ts`, `page.tsx` `generateMetadata` |
| Preço / status vendido | `page.tsx`, componentes de preço, `seo.ts` |
| Parecidos / cross-sell | `vehicles.ts` ou helpers de recomendação |

## Testes

- Unitários: testes em `src/lib` ligados a slug, seo, estoque.
- E2E: `e2e/ficha-v2.spec.ts`, `ficha-itens.spec.ts`, `seo-fichas.spec.ts`, `sold-photo-paint.spec.ts`, `caminho-busca-ficha-whatsapp.spec.ts`.

## Erros comuns de IA

- Mostrar preço em vendido “só no card”.
- Colocar cidade na ficha “para SEO local”.
- Remover pixel por “privacidade” sem combinar com Lucas.
- Revalidar todas as fichas após uma edição.

Ver [`../ANTI-PATTERNS.md`](../ANTI-PATTERNS.md).
