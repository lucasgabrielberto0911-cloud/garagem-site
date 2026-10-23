# Consolidação das alternativas do chat e do CTA de WhatsApp

## Resumo

As duas mudanças já estão reunidas em um único PR aberto: [#376 — feat(agy1): chat alternatives & WhatsApp CTA highlight](https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/376). O PR tem base `main`, está aberto, não é draft e o GitHub o classifica como `MERGEABLE`. Não é necessário criar outro PR nem consolidar branches novamente.

## Evidências

- Atualização feita com `git fetch --all --prune`; `origin/main` em `058f420` (`docs: adicionar badge de status do CI no topo do README (#371)`).
- PR #376 aponta para `reserva/agy1-whatsapp-cta-label`, base `main`, e contém três commits: destaque do CTA, ajuste da label para “Falar no WhatsApp” e alternativas próximas no chat.
- Diff do PR contra `origin/main`: **12 arquivos, 297 adições e 19 remoções**. Arquivos: três specs E2E; ficha de veículo; `VehicleMobileBar.tsx`; `ui.tsx`; testes e módulos `chat-sales-search`, `chat-stock` e `chat-turn`; testes da ficha.
- Branch de alternativas `origin/reserva/10222346642a-1-agy1-chat-sugerir-alternativas` (também `origin/reserva/agy1-chat-alternativas`): HEAD `90121a8`; diff contra `origin/main`: **4 arquivos, 282 adições e 8 remoções** — `chat-sales-search.test.ts`, `chat-sales-search.ts`, `chat-stock.ts` e `chat-turn.ts`.
- Branch da label `origin/reserva/10222346642a-7-ajustar-label-do-botao-whatsap`: HEAD `b8e407c`; diff contra `origin/main`: **6 arquivos, 7 adições e 7 remoções** — ficha de veículo, dois testes da ficha e três specs E2E.
- As duas branches de origem têm alterações representadas no PR #376. A implementação combinada está na branch do PR; as refs de origem continuam disponíveis no remoto.
- Outros PRs abertos: #375 (filtro por cidade), #374 (soldAt) e #372 (CI). Os arquivos alterados por #375 não se sobrepõem aos do #376; #374 e #372 também tratam de outras áreas.
- `git merge-base origin/main origin/reserva/agy1-whatsapp-cta-label` retorna `058f420`, o HEAD atual de `origin/main`. O PR não está atrás da base no momento da inspeção.

## Conflitos potenciais

Não há conflito de merge sinalizado pelo GitHub para #376. Os três commits do PR já combinam as alterações, inclusive mudanças correlatas na ficha e nos testes E2E. O PR #375 altera estoque e filtros, sem arquivos em comum com #376; conflito textual com os PRs abertos consultados não é esperado. Esta conclusão é baseada na lista de arquivos e no estado `MERGEABLE` reportado durante a inspeção.

## Prioridade e próximo passo

1. **Alta / esforço baixo:** revisar o PR #376 existente e acompanhar CI/preview. Manter tudo no mesmo PR; não abrir PR duplicado.
2. **Baixa / esforço baixo:** após merge ou fechamento de #376, arquivar as branches de origem conforme a rotina do coordenador, se já não forem necessárias.

## Tarefas prontas para o planejador

- Revisar e decidir o PR #376: https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/376
- Confirmar os checks de CI e a validação final no preview antes do merge.
