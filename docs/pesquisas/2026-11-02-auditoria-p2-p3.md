# Auditoria P2/P3 — conferência após os PRs #421–#426

Base: `ef91e05` de `origin/main`. Fonte: `~/AUDITORIA-SITE.md`, de 01/11/2026.
Implementação autorizada expressamente pelo Lucas nesta tarefa, incluindo a exceção ao papel de somente pesquisa do Codex.

## Resumo

As correções administrativas já integradas cobrem quase todos os itens restantes no escopo.
Este lote completa o foco de validação do item 29 e acrescenta a matriz isolada do item 50.
Depoimentos, conteúdo público, regras de WhatsApp/chat, SEO, cache de produção e migrations não foram alterados.

## Conferência por item

| Item | Situação no código atual e decisão |
| --- | --- |
| 02 | Já há distinção de indisponibilidade na home: `src/lib/vehicles.ts:177` (`attachQueryError`) e `src/app/(catalog)/page.tsx`. Fluxo cliente reservado ao Claude. |
| 03 | `HeroSearch.tsx` já usa alvos de 44 px (#424/#425). Sem nova mudança. |
| 04 (P3) | `RecentlyViewedVehicles.tsx:38` e `src/lib/recently-viewed.ts` já reutilizam o resultado por 60 s (#425). Sem nova mudança. |
| 05 | `StockFilters.tsx:376` já vincula a contagem à chave do rascunho. Fluxo cliente reservado. |
| 06 | `StockFilters.tsx` já separa mudanças deliberadas de substituição durante digitação. Fluxo cliente reservado. |
| 07 | `StockFilterControls.tsx:78` já acrescenta opção de km externo. Fluxo cliente reservado. |
| 08 | `StockFilters.tsx:337` e `StockFilterFields.tsx:44` já sanitizam a troca de categoria. Fluxo cliente reservado. |
| 09 | O skeleton inicial de `EstoqueBrowse.tsx` evita o flash com JavaScript, mas não resolve por si só links filtrados sem JavaScript. Pendente de avaliação pelo Claude/Gemini: envolve fluxo público e estratégia de renderização/cache. Não declarar como integralmente resolvido. |
| 10–11 | `VehicleGallery.tsx` já restringe o teclado e usa `ResizeObserver` para realinhar o slide. Sem nova mudança. |
| 12 | `FichaSectionNav.tsx:54` já move o foco para o destino. Sem nova mudança. |
| 13 | `ZoomDetailImage.tsx` já mostra erro e tentativa manual. Sem nova mudança. |
| 14 | `src/lib/admin-phone.ts` já normaliza e exige 10/11 dígitos nos cadastros administrativos e venda. Avaliação/chat têm validação própria; não foram alterados. |
| 15–17 | Limites de fotos, prévia local e aviso de rascunho já existem em `SellPhotoUpload.tsx`, `sell-photo-upload.ts` e `SellForm.tsx`. Fluxo cliente reservado. |
| 19 | `OfflineLeadFlush.tsx` e `offline-queue.ts` já coordenam execução/lease. Fluxo do Claude. |
| 21 | Já há TTL na fila offline; expiração não equivale a uma interface persistente de revisão/cancelamento. A parte de recuperação de pendências fica com o Claude. |
| 22 | Já há tratamento de falha de IndexedDB no consumidor. Fluxo do Claude. |
| 23–26 | Chat reservado ao Claude. Os PRs integrados já contêm retentativa sem duplicação, anúncio acessível, fonte de 16 px e tratamento de cards antigos. Não reimplementar nem certificar integralmente esses fluxos neste lote. |
| 29 | **Complementado neste lote.** O foco de títulos e `aria-current=step` já existiam. O erro de pagamento ainda caía no primeiro campo da seção: agora direciona para parcelas, descrição/placa da troca e valor da forma de pagamento inválida. Sem seleção, foca a busca visível em vez do input oculto; sem pagamento, foca a primeira opção de forma de pagamento. Também aciona o direcionamento ao detectar problemas na conclusão. Evidências: `SaleFlow.tsx:71`, `SaleFlowStages.tsx:139` e cenário novo em `e2e/admin-vendas-promissorias.spec.ts`. |
| 30 | `SaleFlowStages.tsx:46` e `:69` já lançam erro para HTTP não OK e diferenciam 401. |
| 31 | `ReviewStage` usa `adminDate` e explica o registro efetivo. `src/lib/admin-date.ts` fixa `America/Sao_Paulo`. |
| 32 | `SaleFlow.tsx` já usa alerta com `text-red-400`, borda e fundo próprios. |
| 34 | `commercialStoreSnapshot` já entra nos snapshots de venda e reserva. `commercial-pdf.ts:88` lê a identificação preservada, com fallback legado fixo. Não é possível recuperar dados históricos ausentes de documentos anteriores. |
| 38 | `promissorias/actions.ts:180` já exige motivo e preserva a baixa anterior no evento de auditoria `promissory.payment.reversed`. |
| 39 | A rota de PDF por CPF já limita a consulta a 61 e recusa lotes acima de 60, orientando seleção por lote. |
| 40 | `admin/agenda/page.tsx` já rotula os contadores como atendimentos e informa o total separado de pós-venda. |
| 41 | A agenda já aplica busca a pós-venda e avisos de baixa. |
| 42 | A agenda já possui contagens, ordenação com desempate por ID e paginações independentes para tarefas e avisos. |
| 43 | Avisos de baixa já são descritos como caixa de entrada de todos os períodos. |
| 44 | `clientes/actions.ts` já audita criação/edição na transação, sem copiar dados pessoais para o log. |
| 45 | Cadastro já envia `expectedUpdatedAt`, atualiza por comparação e preserva o preenchimento em conflito/migration pendente. |
| 46 | `clientes/actions.ts:34` já impõe limites e valida formato de e-mail no servidor. |
| 47–48 | SEO/performance técnica reservados ao Gemini. Não foram alterados. |
| 50 | **Implementado neste lote.** Configuração separada com WebKit em 320/390/430 px e Chromium com SW permitido. Shard 1 do CI executa a suíte; falhas bloqueiam o check agregador existente. |

Itens P1 (01, 18, 20, 27, 28, 33, 35, 36, 37, 49) ficam fora da solicitação P2/P3.
O item 01 também é explicitamente proibido: nenhum depoimento foi alterado ou removido.

## Evidências e limites da nova cobertura

- `playwright.compat.config.ts`: reutiliza as proteções da configuração principal contra banco externo e notificações.
- `e2e/compatibilidade/webkit.spec.ts`: login com erro acessível, foco, fonte de pelo menos 16 px, largura sem transbordamento e preservação de cadastro ao recusar saída. Administrador fictício criado e removido no banco local; cliente não é gravado.
- `e2e/compatibilidade/service-worker.spec.ts`: executa o código real de `public/sw.js` em HTTP local, com HTML fictício e versão controlada. Confere atualização sem perder formulário, ativação do controlador novo sem recarregar o formulário, limpeza de cache, navegação offline, ficha sem cache e reconexão. Não substitui deploy completo de Next nem teste do consumidor de leads do Claude.
- Observação no navegador: `skipWaiting()` ativa o controlador novo na aba existente, mesmo sem `clients.claim()`. O comentário atual de `public/sw.js` descreve retenção do controlador antigo; o teste comprova preservação do formulário sem recarga e a navegação seguinte na versão nova. A revisão desse comentário/estratégia fica na área técnica reservada ao Gemini.
- WebKit emulado não comprova teclado virtual e zoom de um iPhone físico. Essa verificação permanece manual.
- Nenhuma medição de Lighthouse: não houve mudança de aparência pública nem solicitação de preview.

## Prioridades e tarefas de continuidade

1. **P2, impacto médio × esforço baixo:** revisão do foco da venda e execução da suíte nova no CI, incluídos neste PR.
2. **P2, impacto médio × esforço médio, Claude/Gemini:** item 09, resolver representação de filtros em navegação sem JavaScript preservando o cache.
3. **P2, impacto médio × esforço médio, Claude:** item 21, conferir recuperação persistente/cancelamento das pendências offline além do TTL.
4. **P2, impacto médio × esforço baixo, validação manual:** verificar teclado/zoom em Safari no iPhone físico; o runner WebKit não simula o teclado do aparelho.

Resultados finais dos comandos são registrados no corpo do PR após a execução.
