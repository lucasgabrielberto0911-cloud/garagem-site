# Consolidação dos PRs #375 a #380

Data: 2026-10-23. Tarefa: `1023142399a8-2`.

## Resumo

Branch `reserva/consolidated-all`, criada a partir de `origin/main` em
`058f420`. A orientação posterior do orquestrador determina essa branch e a
abertura de PR; substitui a instrução inicial de entregar apenas a branch da
subtarefa. O merge fica com Lucas.

Os conteúdos finais foram aplicados na ordem #377 → #380 → #379, em três
commits lineares. Cada commit consolida o diff final do PR correspondente,
preservando as resoluções das branches de origem sem copiar seus merges.
Não houve conflitos de texto nem necessidade de correções adicionais.

## Evidências da integração

| PR de origem | Commit integrado | Conteúdo |
| --- | --- | --- |
| [#377](https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/377) | `24e63bb` | Alternativas de motos no chat, CTA WhatsApp e filtro por cidade; inclui #375/#376. |
| [#380](https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/380) | `61039a9` | Eventos Meta em `funnel-events.ts`, compatibilidade e comentário de `track-event.ts`; inclui #378. |
| [#379](https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/379) | `75baf8f` | Templates e formatadores em `chat-replies.ts`, consumidores e testes. |

- Os arquivos de #375 são idênticos aos respectivos arquivos de #377.
- A diferença entre #376 e #377 contém apenas os dez arquivos do filtro por cidade.
- A diferença entre #378 e #380 contém apenas o comentário de `track-event.ts`.
- Os 36 arquivos alterados por apenas um dos três PRs são idênticos à origem.
- Cinco arquivos combinam mudanças: ficha, `EstoqueBrowse.tsx`,
  `VehicleMobileBar.tsx`, `chat-stock.ts` e `chat-turn.ts`. A revisão confirmou
  a preservação dos imports de tracking, CTA e alternativas junto aos templates.
- `git rev-list --count --merges origin/main..HEAD`: zero merges.
- O diff funcional contém 41 arquivos, 1.594 linhas adicionadas e 850 removidas.

## Validação local

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Passou, sem avisos. |
| `npx tsc --noEmit` | Passou. |
| `npx tsc --noEmit --project tsconfig.test.json` | Passou. |
| `npm test` | 1.452 testes passaram, zero falhas ou testes ignorados; aproximadamente 268 s. |
| `npx tsx --test src/components/site/estoque/FiltroCidade.test.tsx` | Um teste passou. |
| `git diff --check origin/main...HEAD` | Passou. |

Build completo e Playwright ficam para o CI do PR, conforme a restrição da
tarefa de não executar `next build` localmente. O workflow existente executa
build e E2E em quatro shards, com Postgres isolado. Acompanhar os resultados no
PR; este registro descreve a validação local anterior ao push.

## Prioridades e pendências para revisão

1. **Alto impacto, baixo esforço:** conferir o CI da branch consolidada antes
   da revisão final, incluindo `unit`, quatro shards E2E, `migrations` e `check`.
2. **Alto impacto, baixo esforço:** registrar a divergência entre o filtro
   público por cidade de #375/#377 e a proibição atual no `AGENTS.md`. O filtro
   foi preservado por fazer parte dos PRs explicitamente solicitados; a cidade
   continua fora dos registros públicos e dos cards. Lucas deve considerar
   essa divergência na revisão do conjunto.
3. **Médio impacto, esforço moderado:** se solicitado preview, validar
   visualmente estoque e CTA nas larguras 320, 390, 430 e 1440 px e medir
   performance. Não houve medição Lighthouse nesta etapa.

Nenhum banco ou variável de produção foi alterado. Não foi solicitado preview
Vercel, nem feito merge ou fechamento dos PRs de origem.
