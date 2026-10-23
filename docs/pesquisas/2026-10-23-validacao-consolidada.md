# Validação da branch consolidada

Data: 2026-10-23. Tarefa: `1023142399a8-3`.

## Resumo

Validação concluída sobre `c4179632cd643d99f8158b085d3fc7fa9b441db5`,
HEAD local e remoto de `reserva/consolidated-all` e do PR #381 no momento
da consulta. Lint, tipos e os 1.452 testes unitários passaram. Nenhum código
precisou ser alterado. Este relatório é a única alteração da tarefa.

A branch de entrega é `reserva/1023142399a8-3-rodar-lint-type-check-e-testes`,
criada diretamente da consolidação para validar o resultado da dependência,
em vez de validar apenas `origin/main`. A referência remota com o nome da
subtarefa anterior não existe; seu resultado está na branch consolidada e
em `docs/pesquisas/2026-10-23-consolidacao-prs.md:9`.

## Evidências e medições

Cada comando foi limitado a 600 segundos, preservando seu código de saída.

| Verificação | Resultado |
| --- | --- |
| `npm ci` | Exit 0; 465 pacotes instalados, 466 auditados; 33 s informados pelo npm. |
| `npx prisma generate` | Exit 0; cliente Prisma 6.19.3 gerado, sem operação no banco. |
| `npm run lint` | Exit 0; sem erros ou avisos; 133 s. |
| `npx tsc --noEmit` | Exit 0. |
| `npx tsc --noEmit --project tsconfig.test.json` | Exit 0; as duas verificações de tipos levaram 43 s juntas. |
| `npm test` | Exit 0; 1.452 passaram, zero falhas, cancelamentos ou ignorados; 163 s. |
| `npx tsx --test src/components/site/estoque/FiltroCidade.test.tsx` | Exit 0; um teste passou; 2 s. |
| `git diff --check origin/main...HEAD` | Exit 0. |
| `git ls-files -u` e busca de marcadores de conflito nos arquivos-alvo | Nenhuma entrada não resolvida ou marcador encontrado. |

O teste do componente foi executado separadamente porque `package.json:14`
limita `npm test` aos arquivos `src/lib/*.test.ts`. A verificação adicional
de tipos inclui testes excluídos pelo tsconfig principal.

Logs locais em `/tmp/1023142399a8-3-{npm-ci,prisma,lint,tipos,testes,filtro-cidade}.log`.
O arquivo preexistente não rastreado `docs/pesquisas/2026-10-23-alternativas-chat.md`
foi preservado e não faz parte da entrega.

## CI existente

O [PR #381](https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/381)
estava em rascunho e com `check`, `unit`, `migrations` e os quatro shards E2E
aprovados no mesmo commit validado localmente, conforme `gh pr checks 381`
e `gh pr view 381 --json headRefOid,isDraft,url`.

[Execução do CI consultada](https://github.com/lucasgabrielberto0911-cloud/garagem-site/actions/runs/39996507122).
O preview Vercel foi pulado pelo Ignored Build Step; seu status não comprova
um deploy de preview. Não foi aberto outro PR, feito merge ou alterada produção.

## Prioridades e tarefas para revisão

1. **Alto impacto, baixo esforço:** decidir na revisão do PR #381 a divergência
   entre o filtro público por cidade integrado e a proibição no `AGENTS.md`.
   Evidência já registrada em `docs/pesquisas/2026-10-23-consolidacao-prs.md:53`.
   As verificações aprovadas não resolvem essa decisão de escopo.
2. **Médio impacto, esforço a determinar:** investigar em tarefa própria as
   três vulnerabilidades moderadas informadas por `npm ci`. A instalação
   também avisou que ESLint 9.39.5 não tem mais suporte. Não foi executado
   `npm audit fix` nem alterada qualquer dependência nesta validação.
3. **Médio impacto, esforço moderado:** caso necessário à revisão visual,
   solicitar preview final e conferir estoque/CTA e performance nas larguras
   previstas pelo projeto. Não houve build completo, Playwright ou Lighthouse
   local nesta tarefa; build completo local é proibido pelo pedido e os E2E
   foram consultados no CI existente.
