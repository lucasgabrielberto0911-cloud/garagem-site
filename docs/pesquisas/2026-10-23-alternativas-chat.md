# Alternativas do chat: filtro de câmbio e faixa de preço

## Resumo

A melhoria descrita no pedido 10230044f6ac não está coberta pelos PRs de chat já abertos (#376 e #377). O fluxo de alternativas mistura dois comportamentos: em uma busca por moto automática, pode trocar para manual silenciosamente; e o fluxo de alternativas de carros não retorna grupos separados dentro/fora de ±20% do preço de referência. É necessário ajustar o formato de resultado para preservar ambos os grupos até a apresentação.

## Evidências

- `src/lib/chat-stock.ts:3260-3290` — `findMotoAlternatives` escolhe manuais se não houver automático (`isGearFallback`) e, para pedido manual, usa todas as motos como fallback se não encontrar manual. Isso permite que o câmbio solicitado seja ignorado.
- `src/lib/chat-stock.ts:3220-3240` — a faixa de preço é calculada como 80% a 120% do preço de referência. Quando vazia, a lista é substituída pelos veículos de menor distância, sem indicar que estão fora da faixa.
- `src/lib/chat-sales-search.ts:110-130` — o fluxo “outras opções” formata uma única coleção de `picks`; não há rótulo de proximidade de orçamento.
- `src/lib/chat-cards.ts` — prepara cards a partir da coleção retornada; deve continuar recebendo apenas veículos únicos e preservar a ordem dos grupos.
- PR #377 já inclui alternativas de chat, mas seu corpo descreve faixa de preço e alternativas genéricas. Os arquivos listados não incluem `chat-search-filters.ts` nem uma estrutura para separar grupos dentro/fora da faixa.

## Prioridades (impacto × esforço)

1. **Alta / baixa** — tornar câmbio estrito: filtrar candidatos pelo câmbio pedido e, se não houver nenhum, retornar ausência de alternativas compatíveis com chamada para lista de espera. Não misturar outro câmbio sem autorização explícita do cliente.
2. **Alta / média** — retornar grupos estruturados `withinBudget` e `outsideBudget` calculados em torno do preço de referência (±20%), com limite por grupo e deduplicação. Não esconder o segundo grupo quando o primeiro estiver vazio.
3. **Média / baixa** — apresentar os grupos com rótulos claros, como “Opções próximas ao seu orçamento” e “Outras opções”, mantendo filtros de câmbio e sem repetir veículos já exibidos.
4. **Média / baixa** — cobrir os limites inclusivos da faixa, conjunto vazio em um dos grupos, somente opções fora da faixa e pedido manual/automático sem correspondência.

## Tarefas prontas para issue/PR

- Em `chat-stock.ts`, remover fallback silencioso de câmbio divergente na busca de alternativas e explicitar o caso sem correspondência.
- Em `chat-search.ts` / `chat-search-filters.ts`, transportar preço de referência e faixa ±20% como filtros/resultado, sem descartar candidatos fora dela.
- Em `chat-sales-search.ts`, manter a preferência de câmbio e a deduplicação de itens apresentados no histórico ao solicitar “outras”.
- Em `chat-cards.ts`, apresentar grupos separados com rótulos, mantendo cards consistentes com os veículos devolvidos.
- Adicionar testes unitários para manual/automático e particionamento de preços nos limites de 80% e 120%, incluindo ambos os grupos vazios individualmente.
- Validar com testes `chat-stock*.test.ts` e `chat-search*.test.ts`, lint e `npx tsc --noEmit`; validação manual no chat deve cobrir busca manual sem correspondência e orçamento com candidatos dentro e fora da faixa.

## Limitação desta execução

O `AGENTS.md` deste repositório define Codex como agente de pesquisa e diagnóstico e proíbe escrita de código, autorizando apenas relatórios em `docs/pesquisas/`. Além disso, já há PRs abertos na área `chat` (#376 e #377), e as regras do repo vedam trabalho simultâneo na mesma área. Por isso, este relatório é o único artefato produzido; a implementação e o push para `reserva/*` devem ser atribuídos a um agente autorizado a alterar código, sem abrir PR nesta execução.
