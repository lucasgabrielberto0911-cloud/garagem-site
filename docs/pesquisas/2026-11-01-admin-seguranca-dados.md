# Correções de admin, segurança e integridade de dados

Data: 01/11/2026. Branch: `reserva/aud-codex`.

## Resumo

Lote solicitado a partir de `AUDITORIA-SITE.md`, `AUDITORIA-FLUXO.md` e `AUDITORIA-TECNICA.md`. Depoimentos permanecem intactos.

## Evidências e cobertura do lote

| Auditoria | Correção | Implementação / regressão |
| --- | --- | --- |
| SITE 27 (P1) | Exclusão bloqueada quando há qualquer reserva, documento comercial ou venda; decisão auditada e exclusão na mesma transação. FKs de reserva e documento passam a RESTRICT. | `src/app/admin/veiculos/actions.ts`, `prisma/schema.prisma`, `src/lib/admin-audit-regression.test.ts`, `e2e/admin-auditoria.spec.ts` |
| SITE 28–32 (P1/P2) | Rascunho privado autenticado por atendente e contexto, retenção de 24h, recuperação, descarte explícito e aviso durante gravação pendente. Etapa/foco acessíveis, busca com erro recuperável, data em Brasília e erro legível no tema escuro. | `src/components/admin/SaleFlow.tsx`, `useSaleDraft.ts`, `SaleFlowStages.tsx`, `SearchSelect.tsx`, API de drafts e e2e de auditoria |
| SITE 33–34 (P1/P2) | Proposta tem título, texto e rodapé próprios, sem cláusulas ou assinatura contratual. Novas emissões preservam identificação versionada da loja; documentos antigos usam identificação histórica fixa. | `src/lib/commercial-pdf.ts`, `commercial-store.ts`, actions comerciais e `commercial-pdf.test.ts` |
| SITE 35–39 (P1/P2) | O renderizador real confere todas as páginas A4 antes de persistir. Chave e hash da solicitação reconhecem reenvio; índice único reforça a proteção. Nota paga identifica quitação e data, sem nova promessa de pagamento. Retificação exige motivo e preserva baixa original na auditoria. Exportação por CPF limitada; seleção de até 60 notas permite montar lotes entre páginas. | Actions/rota de promissórias, `promissory-pdf.ts`, `submission-id.ts`, testes de PDF, emissão e navegador |
| SITE 40–43 (P2) | Contadores identificados como atendimentos; busca aplicada a pós-venda e avisos; paginação independente e estável dos três conjuntos. Avisos de ciência explicitamente abrangem todos os períodos. | `src/app/admin/agenda/page.tsx`, e2e com 51 tarefas e 51 avisos fictícios |
| SITE 44–46 (P2) | Criação/edição de cliente auditadas sem copiar contato para o log. Versão esperada impede sobrescrita concorrente. Limites e validação de e-mail/telefone no servidor. | Actions e manager de clientes, coluna `Customer.updatedAt`, regressões unitárias e e2e |
| SITE 49 (P1) | Agregador aguarda `migrations` e exige sucesso desse job. | `.github/workflows/ci.yml`, regressão de CI |
| TÉCNICA 14–19 (P1/P2) | Giro móvel já estava no menu nesta base e ganhou validação de navegador. Grades de vendas/clientes/notas ajustadas; fechar do kit com 44×44px; editor de placa preserva área útil e rolagem, ocultando o cabeçalho no celular enquanto o zoom está ativo. | Componentes do admin e `e2e/admin-auditoria.spec.ts` |

Os itens de chat, busca pública, SEO, performance geral e a ampliação global da matriz para WebKit/service worker pertencem a outros escopos. Nenhuma mudança em dados reais de anúncios ou clientes foi realizada.

Referências centrais: `src/app/admin/veiculos/actions.ts:526`; `src/app/admin/promissorias/actions.ts:51` e `:175`; `src/lib/commercial-pdf.ts:62`; `src/components/admin/useSaleDraft.ts:7`; `src/app/admin/clientes/actions.ts:43`; `.github/workflows/ci.yml:96`.

## Ajustes da revisão do PR 426

- Fila offline, formulário público de avaliação e `LeadVenda.requestId` saíram deste PR, inclusive migration, rollback e testes correspondentes. Pertencem ao [PR 423](https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/423). Após o merge de `origin/main` (`81efb49`), o #423 já integra a base: `LeadVenda.requestId` e sua migration vêm exclusivamente dele. Os cinco arquivos de avaliação/fila offline continuam sem diferenças em relação à `main`. A avaliação/chat públicos preservam as verificações adicionais de DDD/prefixo do #423, fora deste lote.
- `admin-customers.ts` repete a listagem com seleção explícita sem `Customer.updatedAt` somente se essa coluna faltar. Outros erros continuam visíveis. Sem versão, criação/edição retornam aviso de atualização pendente e preservam o preenchimento; nenhuma edição sem proteção de concorrência é aceita.
- Promissórias ignoram destaques cujo `indexOf` devolve `-1`; o teste verifica a fonte no aviso de quitação.
- Rascunho de venda usa lista fechada de etapa, valores, opções e parcelas. Não guarda cliente, CPF, RG, endereço, telefone ou texto livre. Cliente/veículo selecionados fora do contexto inicial precisam ser escolhidos novamente; textos de pagamento e condições precisam ser preenchidos de novo. IDs e resumos não sensíveis de notas emitidas são mantidos para não induzir nova emissão.
- A API filtra POST e GET, limpa dados pessoais de rascunho legado ao ler sem alterar a versão e protege a limpeza contra edição concorrente. A migration descarta rascunhos de venda legados ainda não acessados. Não altera rascunhos de veículos.
- Clientes, leads, venda simples, assistente de venda e promissórias compartilham normalização de telefone: formatação e prefixo brasileiro `55` são removidos; resultado tem exatamente 10 ou 11 dígitos nacionais.

## Validação anterior ao complemento

Testes usam somente objetos e dados fictícios, sem banco externo, produção, Supabase ou arquivos `.env`. A API de drafts tem testes de gravação/leitura/reserva, campos malformados e sessão ausente; ações de clientes/leads verificam fallback, conflito e telefone normalizado.

`npm test`: 1.634 testes passaram. `npx tsc --noEmit --project tsconfig.test.json`: passou. `npm run lint`: passou, sem avisos. Em PostgreSQL 16 descartável criado nesta sessão, a listagem funcionou após remover `Customer.updatedAt`; criação sem a coluna devolveu P2022 e a consulta de LeadVenda funcionou sem `requestId`. Depois o schema foi restaurado e os registros fictícios removidos. `npm run build -- --webpack`: passou em cópia isolada, sem `.env`, com PostgreSQL descartável local. O CI usa instalação própria para conferir o build padrão com Turbopack. E2E local e preview não foram executados nesta revisão; o cenário existente de recuperação foi ajustado para exigir que o endereço digitado não seja persistido.

## Prioridades e implantação

| Prioridade | Impacto | Esforço | Tratamento |
| --- | --- | --- | --- |
| P1 | Alto: histórico financeiro, duplicação de dívida e perda de trabalho | Médio | Bloqueios transacionais, idempotência, renderização prévia e rascunho privado |
| P2 | Médio/alto: sobrescrita de dados, falta de rastreabilidade e operações inacessíveis | Baixo/médio | Versão esperada, auditoria, validações, paginação e ajustes de uso no celular |

A migration `supabase/migrations/20261101175529_admin_integridade_emissoes.sql` e o rollback correspondente estão somente em arquivos. Não foram aplicados em produção. Até a aplicação, a listagem de clientes funciona em consulta e as gravações que exigem versão são recusadas com aviso. Listagem, vínculo, retificação e reimpressão de promissórias omitem as colunas novas nas leituras históricas. A emissão idempotente exige suas colunas e, se estiverem ausentes, recusa a gravação com aviso de atualização pendente; a implantação deve ser coordenada. O rollback preserva RESTRICT para não reintroduzir exclusão em cascata do histórico financeiro.

Documentos antigos que nunca gravaram identificação da loja usam a identificação histórica conhecida nesta revisão; alterações históricas não registradas não podem ser reconstruídas.

## Tarefas para revisão do PR

- [ ] Conferir CI completo, incluindo `migrations`, no PR em rascunho.
- [ ] Coordenar aplicação manual da migration antes da implantação.
- [ ] Fazer teste final no preview sob demanda, com fixtures e sem fotos de produção.
- [ ] Merge e produção ficam com o coordenador.

## Complemento da revisão solicitada

- Integrada `origin/main` com #423 e #425, sem conflitos.
- `useSaleDraft.ts:18`: a recuperação depende da chave do rascunho; `useEffectEvent` mantém o callback atual sem repetir a leitura quando uma Server Action atualiza as props. Isso preserva a seleção automática das notas emitidas na venda.
- `e2e/admin-auditoria.spec.ts:41`: cenário de banco local com `Customer.updatedAt`, `PromissoryNote.issuanceKey` e `issuanceHash` temporariamente renomeadas, com restauração em `finally`; verifica clientes, notas e PDF.
- Regressões unitárias cobrem emissão bloqueada sem cada coluna de idempotência e omissão dessas colunas na exportação histórica.

## Validação final local

- `npx tsc --noEmit` e `npx tsc --noEmit --project tsconfig.test.json`: passaram. A segunda checagem foi repetida após o ajuste final do E2E.
- `npm test`: 1.681 testes passaram, zero falhas.
- `npm run lint`: passou; `npx eslint e2e/public-journeys.spec.ts` passou após o ajuste final desse arquivo.
- `npm run build`: passou com Turbopack, instalação própria de dependências e PostgreSQL descartável local, sem arquivos `.env` na cópia.
- Matriz local completa de 676 cenários em 320, 390, 430 e 1440 px: 619 passaram, 56 foram pulados pela configuração padrão e um teste de navegação pública falhou ao tentar ler a posição de um card substituído durante a hidratação. O mesmo cenário passou em quatro repetições isoladas antes da correção. `e2e/public-journeys.spec.ts:84` agora repete a verificação até haver dois cards alinhados, mantendo as exigências de geometria. A revalidação do arquivo inteiro nas quatro larguras passou: 36 testes, zero falhas.
- Os cenários de emissão com seleção automática e de consulta sem colunas novas passaram nas quatro larguras. A rodada direcionada inicial também passou: 11 testes em 320 px.
- `bash scripts/check-migrations.sh origin/main` e `git diff --check`: passaram. Nenhuma migration foi aplicada em ambientes existentes; somente o schema Prisma e fixtures no banco descartável de loopback.

Logs locais: `/tmp/pr426-validation-unit.log`, `/tmp/pr426-validation-build.log`, `/tmp/pr426-validation-e2e.log`, `/tmp/pr426-validation-public.log` e `/tmp/pr426-validation-focused.log`. Preview não executado. A emissão idempotente exige aplicação coordenada da migration; as consultas históricas continuam disponíveis antes dela.
