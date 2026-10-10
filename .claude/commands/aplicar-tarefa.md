---
description: Aplica uma tarefa em branch própria e abre PR rascunho com CI verde
argument-hint: <tarefa ou número da issue>
---
Tarefa: $ARGUMENTS. Siga o AGENTS.md.

1. Confira `gh pr list` (ninguém na mesma área). Crie a branch `claude/<tema-curto>` a partir do main atualizado.
2. Ache o código pelo grafo (MCP code-review-graph: `get_minimal_context_tool`, `query_graph_tool`, `traverse_graph_tool`), depois `rg -n`. Leia só trechos com `sed -n 'a,bp'`; nada de `cat` em arquivo inteiro.
3. Faça a menor mudança que resolve. Antes de mexer em algo compartilhado, veja o raio com `get_impact_radius_tool`.
4. No fim, rode e filtre a saída: `npm test 2>&1 | tail -30`, `npm run lint 2>&1 | tail -30`, `npm run build 2>&1 | tail -40`. Tela pública mudou? Ajuste o e2e.
5. Commit em português e `gh pr create --draft` com: o que mudou, por quê, como validou e o que falta. Espere o CI ficar verde. Não faça merge.
