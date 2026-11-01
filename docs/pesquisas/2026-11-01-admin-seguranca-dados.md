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
| SITE 18–22 (P1/P2) | Avaliação tem chave persistente e criação idempotente; reenvio não repete notificação. Consumidor serial e reserva atômica no IndexedDB coordenam abas. Recados têm recuperação persistente e descarte. Retenção de sete dias; avaliações após 15 minutos exigem confirmação. Falhas de armazenamento são tratadas. | `lead-venda.ts`, action de avaliação, `offline-queue.ts`, `OfflineLeadFlush.tsx`, testes de submissão/fila e `e2e/offline-auditoria.spec.ts` |
| SITE 49 (P1) | Agregador aguarda `migrations` e exige sucesso desse job. | `.github/workflows/ci.yml`, regressão de CI |
| TÉCNICA 14–19 (P1/P2) | Giro móvel já estava no menu nesta base e ganhou validação de navegador. Grades de vendas/clientes/notas ajustadas; fechar do kit com 44×44px; editor de placa preserva área útil e rolagem, ocultando o cabeçalho no celular enquanto o zoom está ativo. | Componentes do admin e `e2e/admin-auditoria.spec.ts` |

Os itens de chat, busca pública, SEO, performance geral e a ampliação global da matriz para WebKit/service worker pertencem a outros escopos. Nenhuma mudança em dados reais de anúncios ou clientes foi realizada.

Referências centrais: `src/app/admin/veiculos/actions.ts:526`; `src/app/admin/promissorias/actions.ts:51` e `:175`; `src/lib/commercial-pdf.ts:62`; `src/components/admin/useSaleDraft.ts:7`; `src/app/admin/clientes/actions.ts:43`; `src/app/(site)/vender/actions.ts:64`; `.github/workflows/ci.yml:96`.

## Validação

- `npm test`: 1.608 testes passaram.
- `npm run lint`: passou.
- `npm run build`: passou, usando banco descartável local.
- `npx playwright test e2e/admin-auditoria.spec.ts e2e/offline-auditoria.spec.ts`: 52 cenários passaram, em 320, 390, 430 e 1440 px.
- `npx tsc --noEmit --project tsconfig.test.json`: passou.
- `scripts/check-migrations.sh origin/main`: passou.
- Após o último ajuste de transporte do formulário, 12 testes específicos de formulário público, fila e chave de submissão também passaram.
- Suítes comerciais existentes: 23 cenários passaram na rodada ampla de 390 px. Os dois cenários afetados pelas novas funções foram ajustados: um agora isola os casos em rascunhos separados, e o outro permite a retificação de baixa sem permitir cancelamento de nota paga.
- `npx playwright test e2e/admin-auditoria.spec.ts e2e/admin-comercial.spec.ts e2e/admin-promissorias.spec.ts --grep 'fotos permitem|CPF duplicado|aba Promissórias'`: mais 12 verificações passaram nas quatro larguras, incluindo os dois cenários ajustados e o ganho de mais de 60 px da área útil no zoom móvel.
- Regressões usam apenas pessoas, contatos e operações fictícias.
- Banco local separado em `127.0.0.1:55432/garagem_e2e`; nenhum acesso a banco de produção.
- Navegador usa fixture local para fotos e bloqueia Storage externo. As suítes comerciais existentes também receberam interceptação de fotos e limpeza compatível com as FKs restritivas.

## Prioridades e implantação

| Prioridade | Impacto | Esforço | Tratamento |
| --- | --- | --- | --- |
| P1 | Alto: histórico financeiro, duplicação de dívida e perda de trabalho | Médio | Bloqueios transacionais, idempotência, renderização prévia e rascunho privado |
| P2 | Médio/alto: sobrescrita de dados, falta de rastreabilidade e operações inacessíveis | Baixo/médio | Versão esperada, auditoria, validações, paginação e ajustes de uso no celular |

A migration `supabase/migrations/20261101175529_admin_integridade_emissoes.sql` e o rollback correspondente estão somente em arquivos. Não foram aplicados em produção. O coordenador deve planejar a aplicação antes do código que exige as novas colunas. O rollback preserva RESTRICT para não reintroduzir exclusão em cascata do histórico financeiro.

Documentos antigos que nunca gravaram identificação da loja usam a identificação histórica conhecida nesta revisão; alterações históricas não registradas não podem ser reconstruídas.

## Tarefas para revisão do PR

- [ ] Conferir CI completo, incluindo `migrations`, no PR em rascunho.
- [ ] Coordenar aplicação manual da migration antes da implantação.
- [ ] Fazer teste final no preview sob demanda, com fixtures e sem fotos de produção.
- [ ] Merge e produção ficam com o coordenador.
