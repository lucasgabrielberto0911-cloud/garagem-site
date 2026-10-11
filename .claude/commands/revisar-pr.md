---
description: Revisa um PR do garagem-site com o grafo e o CI, sem ler arquivos inteiros
argument-hint: <número do PR>
---
Revise o PR #$ARGUMENTS deste repo. Siga o AGENTS.md.

1. `gh pr view $ARGUMENTS` e `gh pr diff $ARGUMENTS --name-only`. Confira se é Draft e se o CI está verde (`gh pr checks $ARGUMENTS`).
2. Impacto pelo grafo (MCP code-review-graph): `detect_changes_tool` ou `get_impact_radius_tool` com os arquivos mudados. Se o grafo estiver velho, peça para rodar `/workspace/bin/atualizar-grafo.sh`.
3. Leia só os trechos mudados: `gh pr diff $ARGUMENTS`, `rg -n` e `sed -n 'a,bp'`. Nada de `cat` em arquivo inteiro.
4. Cheque as regras do AGENTS.md: vendido sem preço, cidade só no admin, cache/ISR (`revalidatePublicStock`), eventos AddToCart/Lead, marca Garagem.
5. Responda curto: veredito (aprovar / pedir ajuste), problemas com arquivo:linha e testes que faltam. Não faça merge nem push.
