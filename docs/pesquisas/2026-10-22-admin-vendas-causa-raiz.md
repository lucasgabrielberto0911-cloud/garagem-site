# Recuperação do admin: anúncios e vendas

Tarefa `10221930cf1a-1`. Retomada autorizada pelo Lucas em 22/10/2026, após o checkpoint de pausa. Trabalho em `reserva/10221930cf1a-1-investigar-apis-admin-listagem`, no worktree `/home/lucas/wt/codex`. A orientação posterior do orquestrador autorizou abrir um Draft PR e acompanhar o CI; ela substitui a regra anterior de entrega sem PR. Merge continua reservado ao coordenador.

## 1. Diagnóstico

**Causa confirmada: aplicação publicada antes da coluna exigida pelo Prisma Client.** O PR #358 (`6cdd755`) acrescentou `Vehicle.soldAt` ao schema e às gravações de status/venda. A migração `supabase/migrations/20261022180400_veiculo_sold_at.sql:1` existe no repositório, mas a coluna não existe no Supabase consultado. Mesmo um `findUnique` sem `select` passa a consultar todos os campos escalares do Client, derrubando telas que aparentemente só leem o veículo.

Evidências de produção, coletadas somente por leitura:

- Supabase, projeto `garagem-site`, região `sa-east-1`: `information_schema.columns` devolveu `Vehicle.chassis`, `Vehicle.renavam` e `Customer.rg`, mas nenhum `Vehicle.soldAt`. Não há evidência de que RLS, RG ou chassi expliquem este incidente.
- Logs do Postgres: 17 erros `42703` (coluna inexistente) na janela de 24 h consultada. Primeiro registro em `2026-10-22 21:36:18.651 UTC`, último em `2026-10-23 00:32:41.777 UTC`. Amostras contêm consultas de `Vehicle` incluindo `soldAt`, executadas pelo usuário `postgres` via Supavisor. Não foram copiados dados de clientes nem parâmetros das consultas para este relatório.
- `src/app/admin/veiculos/[id]/page.tsx:62`: a abertura da edição usa `findUnique` com `include`, sem restringir os campos escalares. `src/app/admin/vendas/nova/page.tsx:13` e `src/app/admin/vendas/actions.ts:61` também leem o veículo completo. As escritas de status também dependiam de `soldAt`.
- A captura fornecida mostra o toast genérico sobre a confirmação simples. Em `src/components/admin/VehiclesTable.tsx:432`, a confirmação só era fechada no sucesso; no erro permanecia aberta. Não há transição de falha da venda completa para abertura automática da venda simples: são estados e chamadores separados. A mensagem genérica da API confundia os dois fluxos.
- Vercel: o plugin respondeu 403. O CLI autenticado, com o mesmo projeto e equipe explícitos, conseguiu consultar os últimos 45 minutos e retornou zero entradas de nível `error`. Isso não cobre todo o incidente. A consulta de 24 h do checkpoint anterior foi rejeitada pela retenção Hobby; não é possível declarar ausência de erros nas últimas 24 h na Vercel.

Rotas reais: `/api/admin/veiculos` e `/api/admin/vendas` são listagens GET. O endpoint de venda é `PATCH /api/admin/vehicles/[id]/sell`, com resposta de sucesso **200**. O fluxo de `/admin/vendas/nova` chama a Server Action `finalizeSaleFlow`, não um POST que retorna 201. Não existem os handlers de detalhe em português indicados no roteiro original.

## 2. Correção de veículos

- `prisma/schema.prisma:75`: `soldAt` fica com `@ignore`, excluindo o campo do Client gerado. O schema continua documentando a coluna, e a migração e seu rollback permanecem intactos. Nenhuma coluna ou dado de produção foi apagado. A semântica de `@ignore` foi conferida na [referência oficial do Prisma](https://docs.prisma.io/docs/orm/reference/prisma-schema-reference#ignore).
- Removidas as escritas de `soldAt` nas ações de edição, status individual, status em lote e marcação de vendido em `src/app/admin/veiculos/actions.ts`. A mesma correção cobre consultas implícitas de edição, duplicação e exclusão, sem espalhar listas manuais de campos pelas páginas.
- Permanecem as travas de concorrência, a proteção contra reabrir veículo com venda ativa, a proteção de reservas com sinal e a invalidação de estoque público.
- O Client deve ser regenerado no CI/deploy (`npx prisma generate`, já parte do build). Um processo de desenvolvimento com o Client antigo precisa ser reiniciado.

## 3. Correção de vendas

- Removida a dependência de `Vehicle.soldAt` da API e de todas as ações de criação, edição, troca de veículo e cancelamento de venda, incluindo registros históricos. Uma venda completa continua com data própria em `Sale.saleDate` e auditoria.
- A API simples continua alterando status, retirando destaque, convertendo reserva sem sinal e registrando auditoria, sem criar `Sale`, comprador, contrato ou faturamento. A data da operação está em `AdminAudit.createdAt`.
- O fluxo completo mantém a transação de comprador, `Sale`, contrato, reserva, status e pós-venda. `revalidatePublicStock` continua sendo chamado com contexto de Route Handler na API e de Server Action nas ações (`src/app/api/admin/vehicles/[id]/sell/route.ts:135`, `src/app/admin/vendas/actions.ts:143`).
- `VehicleCost` representa **despesas**. A venda preserva os custos existentes; não se cria um custo fictício a partir da receita da venda. Os testes conferem a preservação do gasto de revisão, e o faturamento é registrado em `Sale.salePrice`.
- A resposta 500 da marcação simples agora diz “Não foi possível marcar o veículo como vendido.”; a mensagem de registro da venda permanece para o modo completo.

## 4. Correção dos modais

- `src/components/admin/VehiclesTable.tsx:453`: a confirmação simples fecha no `finally`, tanto no sucesso quanto na falha. O toast comunica a falha e o botão da listagem permite nova tentativa. Uma tentativa com falha não muda o status local.
- A confirmação completa continua abrindo o formulário próprio. O teste de navegador cobre falha de validação, preservação de campos, ausência do modal simples e nova tentativa bem-sucedida.
- Não foi necessário alterar o componente global de confirmação nem criar endpoints ou rotas públicas.

## 5. Validação E2E, limites e encaminhamento

Ambiente: Postgres local `garagem_e2e`, schema isolado `admin_recovery_codex`, com credenciais locais e sem integrações externas. A coluna `soldAt` foi removida **somente nesse schema de teste** para reproduzir a condição encontrada em produção. Os testes usam contas, compradores, veículos e custos fictícios e removem suas próprias fixtures.

Verificações locais:

| Comando / cenário | Resultado |
|---|---|
| `npx prisma generate` | Client 6.19.3 regenerado |
| `npx tsx --test src/lib/admin-*.test.ts src/lib/public-stock-revalidate.test.ts` | 165 testes aprovados |
| `npx tsx --test src/lib/admin-sell.test.ts src/lib/admin-sale-integrity.test.ts src/lib/public-stock-revalidate.test.ts` | 30 aprovados na versão final, incluindo dois novos cenários de falha interna sem gravação |
| Playwright: cinco cenários, desktop e celular de 390 px, **sem** `soldAt` | 10 aprovados, 1,7 min |
| Playwright: cinco cenários desktop, **com** `soldAt` | 5 aprovados, 1,2 min |
| Playwright: cinco cenários em 430 px, sem `soldAt`, duas repetições com sincronização das etapas | 10 aprovados, 1,7 min |
| `npm run lint` | Aprovado |
| `npx tsc --noEmit` | Aprovado |
| `npx tsc --noEmit --project tsconfig.test.json` | Aprovado |

A validação de tipos também corrigiu um acesso a `mock` num `beforeEach` existente: o tipo do contexto podia incluir `SuiteContext`, que não oferece essa propriedade.

Cobertura de `e2e/admin-vendas-recuperacao.spec.ts`:

1. Listagem e API de veículos; abrir edição e aba de custos/documentos.
2. Venda simples: PATCH 200, fechamento da confirmação, status vendido, destaque retirado, auditoria e custos preservados, nenhum faturamento ou contrato.
3. Falha 500 simulada da venda simples: confirmação fecha, veículo permanece disponível, nenhum faturamento e nova tentativa funciona.
4. Venda completa pela API: comprador, preço, data, quatro tarefas de pós-venda e custos preservados; segunda venda rejeitada com 409.
5. Venda completa pelo estoque e formulário: falha de validação não abre confirmação simples nem grava venda; dados permanecem; correção do telefone permite gravar contrato/venda e abrir a lista de vendas.

Os E2E locais usaram uma configuração temporária baseada em `playwright.config.ts`, com `npm run dev -- --webpack --hostname 127.0.0.1 --port 3371`, cinco cenários e espera ampliada para a compilação de desenvolvimento. O arquivo temporário foi removido ao terminar. O comando de CI continua usando o build de produção e as quatro larguras previstas no repositório. Lint e tipos foram executados com o servidor parado para evitar a recriação concorrente dos arquivos gerados.

O primeiro CI aprovou 1.439 unitários, lint, tipos, migrações, os quatro builds e três grupos E2E. O grupo de 430 px revelou um timeout no novo cenário completo: o teste agora retira o foco do valor de pagamento e confirma cada etapa antes da próxima interação. O cenário de duas tentativas tem limite próprio de 90 s; os demais limites e a política sem retries foram preservados.

**Limites:** `next build` não foi executado localmente, conforme a regra final da tarefa que reserva o build ao CI. Produção não recebeu migração, seed, venda de teste, alteração de variáveis ou deploy. Até a entrega ser publicada, o site em produção continua sujeito ao erro diagnosticado. `Vehicle.soldAt` não recebe novos valores enquanto ignorado; datas de venda e auditoria continuam registradas. Reativar o campo exige migração validada em todos os ambientes e reconciliação das datas, inclusive veículos reabertos; somente remover `@ignore` recria o incidente.

Prioridades e tarefas prontas para encaminhamento:

| Prioridade | Impacto × esforço | Tarefa | Aceite |
|---|---|---|---|
| P0 | Alto × baixo | Consolidar esta branch, executar CI e publicar a correção de compatibilidade | Edição e duas modalidades de venda funcionando no preview e em produção |
| P1 | Médio × médio | Planejar aplicação autorizada da migração `20261022180400` e reativação de `soldAt` em tarefa própria | Todos os ambientes compatíveis; datas reconciliadas; testes com e sem a coluna atualizados |
| P1 | Alto × médio | Verificar compatibilidade de schema antes de publicar campos novos do Prisma | Um deploy não chega a exigir coluna ausente no banco de destino |

O orquestrador pode usar as cinco seções deste relatório no PR consolidado. Não foram abertas issues ou enviados avisos a terceiros.
