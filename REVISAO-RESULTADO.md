### Resumo da revisão (`56aa500` — `reserva/carro-vendido`)

`npm run check` passou integralmente (`2030` testes unitários, `eslint`, `check-footguns` e `tsc`). A arquitetura de SEO/HTTP 404 via `notFound()` no segmento `/estoque/[id]` está bem encaminhada (`noindex, follow`, sem canonical para URL morta, preservando ficha de vendido no banco, redirect de slug não canônico, `retired-listings` e `sitemap`), o visual segue a paleta da Garagem (sem borda extra no cabeçalho, WhatsApp `#25D366` com texto escuro, sem parcelas/preço de vendido) e o `trackingLabel` é próprio e seguro (`vendido-link-antigo`, sem enviar slug cru ao Meta/GA4).

Porém, há **ajustes obrigatórios** em segurança do parser de slug, layout mobile com 3 cards, duplicação/tamanho de `sold-slug-fallback.ts` e cobertura de testes:

### Ajustes obrigatórios

1. **Segurança — exigir allowlist conhecida também para o modelo (não refletir palavra arbitrária/ofensiva após marca válida):**
   - Em `src/lib/sold-slug-fallback.ts` (`extractModel`, linhas 245–296), a marca é validada contra lista conhecida, mas o modelo usa *denylist* curta (`NOISE_MODEL_TOKENS`) e aceita qualquer token arbitrário com 2+ letras (ou par de até 3 letras + dígitos, linhas 270–281).
   - Com isso, slugs forjados ou sujos com marca válida (ex.: `/estoque/toyota-lixo-2022`, `/estoque/honda-ofensa-2023`, `/estoque/volkswagen-abc1d23-2021`) viram rótulo reconhecido no `<title>`, meta description (prévia de compartilhamento no WhatsApp), cabeçalho da página e texto pré-preenchido do WhatsApp.
   - O modelo precisa sair exclusivamente de uma **allowlist fechada de modelos conhecidos** (e/ou modelos reais presentes no estoque/histórico); qualquer token desconhecido ou ofensivo deve cair no texto genérico (`label: null`).

2. **Visual mobile (390px) — impedir card ímpar esticado na largura total:**
   - `VehicleGrid` usa `.listing-card-grid`, que em `src/app/globals.css` (linhas 498–502) aplica `grid-column: 1 / -1` ao último item quando a contagem é ímpar até `1023px`. Quando há 3 parecidos (ou 1 único disponível), o último card ocupa 100% da largura no celular.
   - Sem tocar em `globals.css` (arquivo compartilhado), ajustar `selectSimilarVehiclesForSoldSlug` / `SoldVehicleNotFound` para exibir quantidade par no celular (**4 ou 2** — quando houver 3 candidatos, cortar para 2) e tratar também o caso de apenas **1** disponível no estoque (mantendo largura de 1 coluna no mobile ou exibindo apenas o CTA).

3. **Proporcionalidade e reaproveitamento — enxugar `src/lib/sold-slug-fallback.ts` (482 linhas) eliminando duplicações:**
   - **Marcas (`src/lib/format.ts`, linhas 18–62):** `BRAND_CANONICAL` / `KNOWN_BRAND_KEYS` já contêm `mercedes-benz`, `land rover`, `caoa chery`, `harley-davidson` e `jac`. Remover `COMPOUND_BRANDS` e `EXTRA_KNOWN_BRANDS` duplicados em `sold-slug-fallback.ts`, completando `BRAND_CANONICAL` em `format.ts` apenas com o que faltar.
   - **Motos e modelos conhecidos:** `MOTO_MODEL_PREFIXES` (linhas 71–78) duplica `MOTO_NAME_HINT` de `src/lib/chat-stock.ts` (linha 70), e `src/lib/catalog-feed.ts` (`BODY_RULES`, linhas 270–293) + `src/lib/vehicle-display.ts` (`MODEL_CANONICAL`) já concentram modelos trabalhados pela loja. Unificar/reaproveitar em uma allowlist enxuta compartilhada.
   - **Mensagem de WhatsApp (`src/lib/site.ts`, linhas 162–166):** `formatCustomerVehicleWhatsAppText` já possui ramo `sold: true` com texto natural para carro, moto e genérico mencionando a Garagem; reaproveitar ou centralizar em `site.ts` em vez de manter `soldOldLinkWhatsAppMessage` separado.
   - **Limpeza menor de SEO/payload:** remover o `export const metadata` sem efeito em `src/app/(vehicle)/estoque/[id]/not-found.tsx` (linhas 7–16, pois o Next usa `generateMetadata` de `page.tsx` quando `notFound()` é chamado na página) e reduzir o lote serializado ao client component em `not-found.tsx` / `getSoldFallbackVehicles` (hoje envia 48 cards completos no RSC de toda resposta 404, com LQIP apenas nos 12 primeiros).

4. **Testes unitários e E2E:**
   - Em `src/lib/sold-slug-fallback.test.ts`: adicionar casos de `<marca-válida>-<palavra-arbitrária/ofensiva/placa>-2022` garantindo retorno `label: null` (`isVehicleLike: false`), além de testar a regra de paridade (estoque com 3 disponíveis retorna 2).
   - Em `e2e/link-antigo-vendido.spec.ts`: validar em viewport mobile `390x844` que nenhum card de parecido ocupa a largura inteira da grade, testar `<marca-válida>-<lixo>` não refletindo o termo na página/título/WhatsApp, e cobrir não-regressão da ficha de vendido existente no banco (200) e de `retired-listings` (redirect para `/estoque`).

### Arquivos revisados
- `src/app/(vehicle)/estoque/[id]/page.tsx`
- `src/app/(vehicle)/estoque/[id]/not-found.tsx`
- `src/components/site/SoldVehicleNotFound.tsx`
- `src/lib/sold-slug-fallback.ts`
- `src/lib/sold-slug-fallback.test.ts`
- `src/lib/vehicles.ts`
- `e2e/link-antigo-vendido.spec.ts`

VEREDITO: AJUSTAR
VERTEX_USAGE model=gemini-4-carbon pedido=gemini-4-carbon:high input=302148 cached=3174956 output=6361 thoughts=23813 total=3507278 reqs=36
VERTEX_USAGE model=gemini-3-flash-preview pedido=gemini-4-carbon:high input=13993 cached=0 output=92 thoughts=440 total=14525 reqs=1
