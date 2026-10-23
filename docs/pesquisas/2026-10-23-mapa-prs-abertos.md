# Mapa dos PRs abertos para consolidação

Data: 2026-10-23. Inspeção dos PRs #379, #376, #378, #380, #375 e #377. Fonte dos caminhos e contagens: `gh pr view --json ...` e `gh pr diff --name-only`; branches foram buscadas em `refs/pull/*/head` para comparar os arquivos sobrepostos. O escopo desta etapa é diagnóstico, sem consolidação de código.

## PRs

### #379 — `reserva/10230027e8cf-final`
**Título:** PR final do pedido 10230027e8cf. **Base:** `main`. **Resumo:** centraliza textos de resposta e formatadores do chat em `chat-replies.ts`, com testes, atualizando consumidores do chat.

Arquivos:

- `src/lib/chat-cards.ts`
- `src/lib/chat-guard.ts`
- `src/lib/chat-http.ts`
- `src/lib/chat-lead.ts`
- `src/lib/chat-prompt.ts`
- `src/lib/chat-replies.test.ts`
- `src/lib/chat-replies.ts`
- `src/lib/chat-sold.ts`
- `src/lib/chat-stock.ts`
- `src/lib/chat-turn.ts`

### #376 — `reserva/agy1-whatsapp-cta-label`
**Título:** feat(agy1): chat alternatives & WhatsApp CTA highlight. **Base:** `main`. **Resumo:** sugere motos alternativas no chat quando a busca não encontra resultado e destaca o CTA WhatsApp da ficha, com ajustes de label e testes.

Arquivos:

- `e2e/admin-leads-fluxo.spec.ts`
- `e2e/seo-modelos-funil.spec.ts`
- `e2e/sold-photo-paint.spec.ts`
- `src/app/(vehicle)/estoque/[id]/page.tsx`
- `src/components/site/VehicleMobileBar.tsx`
- `src/components/site/ui.tsx`
- `src/lib/chat-sales-search.test.ts`
- `src/lib/chat-sales-search.ts`
- `src/lib/chat-stock.ts`
- `src/lib/chat-turn.ts`
- `src/lib/ficha-cta.test.ts`
- `src/lib/ficha-jump.test.ts`

### #378 — `reserva/102300025fce-3-abrir-pr-da-branch-reserva`
**Título:** refactor: unificar meta-pixel e VehiclePixel em funnel-events. **Base:** `main`. **Resumo:** concentra implementação e componentes dos eventos Meta em `funnel-events.ts`, preserva compatibilidade por re-export e migra importadores.

Arquivos:

- `src/app/(catalog)/page.tsx`
- `src/app/(site)/seminovos/[cidade]/page.tsx`
- `src/app/(vehicle)/estoque/[id]/page.tsx`
- `src/components/site/EstoqueBrowse.tsx`
- `src/components/site/SellForm.tsx`
- `src/components/site/VehicleCardWhatsApp.tsx`
- `src/components/site/VehicleMobileBar.tsx`
- `src/components/site/VehiclePixel.tsx` (removido)
- `src/components/site/VehicleQuickActions.tsx`
- `src/components/site/WantedVehicleCta.tsx`
- `src/lib/funnel-events.test.ts`
- `src/lib/funnel-events.ts`
- `src/lib/meta-pixel.ts`

### #380 — `reserva/102300025fce-final`
**Título:** Unifica Meta Pixel em funnel-events.ts. **Base:** `main`. **Resumo:** mesma unificação do #378, mais uma correção de comentário em `track-event.ts`.

Arquivos:

- `src/app/(catalog)/page.tsx`
- `src/app/(site)/seminovos/[cidade]/page.tsx`
- `src/app/(vehicle)/estoque/[id]/page.tsx`
- `src/components/site/EstoqueBrowse.tsx`
- `src/components/site/SellForm.tsx`
- `src/components/site/VehicleCardWhatsApp.tsx`
- `src/components/site/VehicleMobileBar.tsx`
- `src/components/site/VehiclePixel.tsx` (removido)
- `src/components/site/VehicleQuickActions.tsx`
- `src/components/site/WantedVehicleCta.tsx`
- `src/lib/funnel-events.test.ts`
- `src/lib/funnel-events.ts`
- `src/lib/meta-pixel.ts`
- `src/lib/track-event.ts`

### #375 — `reserva/10222346642a-5-agy2-estoque-filtro-rapido-por`
**Título:** Estoque: filtro rápido por cidade (chips mobile + dropdown desktop). **Base declarada no GitHub:** `reserva/agy2-filtro-cidade-estoque`. **Resumo:** adiciona filtro público por cidade sincronizado à URL e à consulta do estoque, sem incluir a cidade nos dados públicos expostos.

Arquivos:

- `e2e/estoque-cidade.spec.ts`
- `src/components/site/EstoqueBrowse.tsx`
- `src/components/site/StockFilters.tsx`
- `src/components/site/StockFiltersSkeleton.tsx`
- `src/components/site/estoque/FiltroCidade.test.tsx`
- `src/components/site/estoque/FiltroCidade.tsx`
- `src/lib/public-journey.test.ts`
- `src/lib/stock-query.test.ts`
- `src/lib/stock-query.ts`
- `src/lib/stock-share.test.ts`

### #377 — `reserva/10222346642a-final`
**Título:** PR final do pedido 10222346642a. **Base:** `main`. **Resumo:** reúne filtro por cidade, alternativas no chat e destaque/label do CTA WhatsApp; o corpo informa que inclui o trabalho de #375 e conteúdo equivalente ao #376.

Arquivos:

- `e2e/admin-leads-fluxo.spec.ts`
- `e2e/estoque-cidade.spec.ts`
- `e2e/seo-modelos-funil.spec.ts`
- `e2e/sold-photo-paint.spec.ts`
- `src/app/(vehicle)/estoque/[id]/page.tsx`
- `src/components/site/EstoqueBrowse.tsx`
- `src/components/site/StockFilters.tsx`
- `src/components/site/StockFiltersSkeleton.tsx`
- `src/components/site/VehicleMobileBar.tsx`
- `src/components/site/estoque/FiltroCidade.test.tsx`
- `src/components/site/estoque/FiltroCidade.tsx`
- `src/components/site/ui.tsx`
- `src/lib/chat-sales-search.test.ts`
- `src/lib/chat-sales-search.ts`
- `src/lib/chat-stock.ts`
- `src/lib/chat-turn.ts`
- `src/lib/ficha-cta.test.ts`
- `src/lib/ficha-jump.test.ts`
- `src/lib/public-journey.test.ts`
- `src/lib/stock-query.test.ts`
- `src/lib/stock-query.ts`
- `src/lib/stock-share.test.ts`

## Arquivos com sobreposição

| Arquivo | PRs que alteram |
|---|---|
| `src/lib/chat-stock.ts` | #379, #376, #377 |
| `src/lib/chat-turn.ts` | #379, #376, #377 |
| `src/app/(vehicle)/estoque/[id]/page.tsx` | #376, #378, #380, #377 |
| `src/components/site/VehicleMobileBar.tsx` | #376, #378, #380, #377 |
| `src/components/site/EstoqueBrowse.tsx` | #378, #380, #375, #377 |
| `src/lib/chat-sales-search.test.ts` | #376, #377 |
| `src/lib/chat-sales-search.ts` | #376, #377 |
| `src/components/site/ui.tsx` | #376, #377 |
| `src/lib/ficha-cta.test.ts` | #376, #377 |
| `src/lib/ficha-jump.test.ts` | #376, #377 |
| `e2e/admin-leads-fluxo.spec.ts` | #376, #377 |
| `e2e/seo-modelos-funil.spec.ts` | #376, #377 |
| `e2e/sold-photo-paint.spec.ts` | #376, #377 |
| `src/components/site/StockFilters.tsx` | #375, #377 |
| `src/components/site/StockFiltersSkeleton.tsx` | #375, #377 |
| `src/components/site/estoque/FiltroCidade.tsx` | #375, #377 |
| `src/components/site/estoque/FiltroCidade.test.tsx` | #375, #377 |
| `src/lib/stock-query.ts` | #375, #377 |
| `src/lib/stock-query.test.ts` | #375, #377 |
| `src/lib/stock-share.test.ts` | #375, #377 |
| `src/lib/public-journey.test.ts` | #375, #377 |
| `e2e/estoque-cidade.spec.ts` | #375, #377 |
| `src/app/(catalog)/page.tsx` | #378, #380 |
| `src/app/(site)/seminovos/[cidade]/page.tsx` | #378, #380 |
| `src/components/site/SellForm.tsx` | #378, #380 |
| `src/components/site/VehicleCardWhatsApp.tsx` | #378, #380 |
| `src/components/site/VehicleQuickActions.tsx` | #378, #380 |
| `src/components/site/WantedVehicleCta.tsx` | #378, #380 |
| `src/lib/funnel-events.ts` | #378, #380 |
| `src/lib/funnel-events.test.ts` | #378, #380 |
| `src/lib/meta-pixel.ts` | #378, #380 |
| `src/components/site/VehiclePixel.tsx` | #378, #380 |
| `src/lib/track-event.ts` | #380 |

## Dependências e redundâncias inferidas

- **#377 agrega conteúdo de #375 e #376.** O próprio corpo do #377 declara o filtro #375 e as mudanças de chat/CTA equivalentes ao #376. Há sobreposição integral dos caminhos tocados por #375/#376 em #377; esses PRs parecem ser fontes/versões anteriores, não mudanças independentes a aplicar em duplicidade.
- **#378 e #380 são o mesmo commit funcional inicial** (`d4ff577`); #380 acrescenta um commit para atualizar comentário em `src/lib/track-event.ts`. Preferir #380 se a intenção for escolher apenas um.
- **#379 e #376/#377 colidem em `chat-stock.ts` e `chat-turn.ts`.** São funcionalidades distintas: #379 extrai respostas/templates para `chat-replies.ts`, enquanto #376/#377 adicionam busca de alternativas no estoque/chat. O código novo desses últimos não parece depender de `chat-replies.ts`; a relação é de edição concorrente e requer resolução cuidadosa para preservar ambos os conjuntos de mudanças.
- **#378/#380 cruzam com #376/#377** na ficha e em `VehicleMobileBar.tsx`: um migra imports de tracking; os outros ajustam apresentação/label do CTA. As intenções são compatíveis, mas a resolução deve manter os imports do módulo canônico e o CTA atualizado.
- **#375 e #378/#380 cruzam em `EstoqueBrowse.tsx`**: filtro e migração de imports de tracking, alterações independentes no mesmo componente.
- Nenhum PR toca schema, migrations, workflow, Tailwind ou package manifest.

## Ordem recomendada para consolidação

1. Usar **#377 como base do conjunto de UX**, pois já reúne os conteúdos de #375 e #376. Não reaplicar #375 nem #376 como PRs separados sem antes confirmar que há commits exclusivos fora do conteúdo descrito.
2. Integrar **#380** (e não também #378), preservando as atualizações de import em `EstoqueBrowse`, ficha e `VehicleMobileBar`; resolver essas sobreposições junto das mudanças já reunidas por #377.
3. Integrar **#379** por último, revisando manualmente `chat-stock.ts` e `chat-turn.ts` para manter tanto alternativas de estoque como a extração de respostas. Alternativamente, a integração #379 pode vir antes de #377 se os testes e a revisão confirmarem que a adaptação da funcionalidade de alternativas aos novos templates é mais limpa; não há dependência lógica obrigatória.

Em termos de trabalho de consolidação, os grupos são: (#377 com #380) + #379; #375 e #376 são redundantes em relação a #377; #378 é redundante em relação a #380.
