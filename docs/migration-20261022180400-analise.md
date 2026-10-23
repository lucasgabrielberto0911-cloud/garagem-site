# Análise da migração 20261022180400 — data de venda

Data: 22/10/2026. Tarefa: `10222221ab78-1r`. Base examinada: `e7699d9`, na branch `reserva/10222221ab78-1-analisar-migration-20261022180`.

## Decisão e limites

**Aplicar o SQL existente após conferir o schema de cada ambiente; separar a reconciliação histórica e a reativação do Client em etapas. Não introduzir baseline do Prisma Migrate para esta mudança.** A migração é pequena e aditiva, mas seu preenchimento cobre apenas vendidos que possuem `Sale`. Não resolve vendas simples, datas divergentes nem datas antigas de veículos reabertos.

Esta entrega altera somente este relatório, no caminho solicitado pela tarefa. Não aplica migração remota, não remove `@ignore`, não publica aplicação e não altera variáveis da Vercel. Os comandos de produção abaixo são um roteiro para execução posterior pelo responsável autorizado, conforme `AGENTS.md` e `supabase/README.md:7`.

Não houve nova consulta ao banco de produção ou preview nesta tarefa. A ausência de `soldAt` em produção foi registrada na investigação do commit `69fd619`, seção 1 de `docs/pesquisas/2026-10-22-admin-vendas-causa-raiz.md`, disponível no [PR #370](https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/370). Esse diagnóstico anterior precisa ser reconfirmado antes da aplicação; não comprova o estado atual de todos os ambientes.

## 1. O que realmente existe no repositório

O alvo `prisma/migrations/20261022180400/migration.sql` citado no pedido **não existe nesta base**. O arquivo canônico é `supabase/migrations/20261022180400_veiculo_sold_at.sql:1–9`; a pasta única de migrações é `supabase/migrations` (`supabase/README.md:3–7`). Não criar uma segunda cópia sob `prisma/migrations`.

| Objeto/operação | Alteração efetiva | Consequência |
|---|---|---|
| `ALTER TABLE "Vehicle"` | Adiciona `"soldAt" TIMESTAMP(3)` com `IF NOT EXISTS` | Coluna nullable, sem default, sem fuso horário; precisão de milissegundos |
| `UPDATE ... FROM "Sale"` | Copia `Sale.saleDate` quando os IDs correspondem, o veículo está vendido e `soldAt IS NULL` | Preserva datas existentes; não preenche veículos sem venda registrada |
| `CREATE TABLE`, índices, constraints | Nenhum | Depende das tabelas e integridade existentes; não acrescenta custo de manutenção de índice |
| RLS, grants, funções, triggers | Nenhuma alteração explícita | Conferir configuração existente, especialmente triggers que possam reagir ao UPDATE |
| `updatedAt` | Não consta do UPDATE | SQL direto não executa o `@updatedAt` do Prisma; triggers reais podem ter comportamento adicional |
| Transação | Arquivo sem `BEGIN/COMMIT` | Usar um invólucro transacional ao aplicar para evitar estado parcial entre comandos |

O rollback em `supabase/rollback/20261022180400_veiculo_sold_at.sql:1` executa `DROP COLUMN IF EXISTS "soldAt"`. **É destrutivo:** perde todas as datas dessa coluna, inclusive vendas simples sem `Sale` que permita reconstruí-las. Não é o rollback operacional recomendado.

A migração `supabase/migrations/20261021000300_contrato_chassi_renavam_rg.sql:1–10` adiciona `Vehicle.chassis`, `Vehicle.renavam` e `Customer.rg` como `TEXT` nullable, com transação própria e `IF NOT EXISTS`. Não participa do preenchimento de `soldAt`. Campos presentes no schema do Client também precisam existir no banco; não presumir que essa migração foi aplicada apenas porque é anterior no nome. O diagnóstico do PR #370 encontrou essas três colunas, mas não `soldAt`.

## 2. Schema atual versus correção de compatibilidade

| Referência | Estado de `soldAt` | Implicação |
|---|---|---|
| Base desta tarefa (`e7699d9`), `prisma/schema.prisma:75` | `soldAt DateTime?`, **sem `@ignore`**, sem `@default` e sem `@db.*` | Client gerado inclui o campo; mapeamento PostgreSQL padrão é `timestamp(3)` |
| Correção `69fd619` do PR #370 | `soldAt DateTime? @ignore`, com comentário de reativação posterior | Exclui o campo do Client; remove também as escritas das ações e API |
| Banco de cada ambiente | Não inspecionado nesta tarefa | Verificar coluna, tipo, precisão, default e nulabilidade por SQL; schema versionado não comprova DDL aplicado |

`Vehicle.status` é `String` com default `disponivel`, não enum (`prisma/schema.prisma:51`). `Sale.vehicleId` é obrigatório, `@unique` e relacionado a `Vehicle`; `Sale.saleDate` é `DateTime @default(now())` (`prisma/schema.prisma:201–213`). No banco alinhado há uma venda por veículo. Duplicatas ou órfãos indicam desvio de integridade e bloqueiam o preenchimento até investigação.

Aplicar o SQL não regenera nem publica o Client. Remover apenas `@ignore` tampouco restaura as escritas removidas no PR #370. A implementação posterior deve partir da branch consolidada vigente, preservar a recuperação do admin e reintroduzir todas as gravações necessárias.

Pontos concretos a revisar nessa implementação:

- API simples/completa: `src/app/api/admin/vehicles/[id]/sell/route.ts:46,99–132`. Completa deve usar a mesma data de `Sale.saleDate`; simples registra a data da transição e auditoria, sem inventar `Sale` ou faturamento.
- Criação, edição, histórico, troca de veículo e cancelamento de venda: `src/app/admin/vendas/actions.ts:138,350,429,525,561,578,669`. Reabertura e veículo anterior numa troca precisam ficar com `soldAt = NULL`.
- Edição e mudanças de status individuais/em lote: `src/app/admin/veiculos/actions.ts:430,576,624–625,717–718`. Há caminhos que usam `new Date()` até ao marcar novamente como vendido. Não restaurar isso indiscriminadamente: preservar data válida em repetição sem transição; venda completa segue `Sale.saleDate`.
- Manter transações, locks, bloqueio de reabertura com venda ativa e invalidação do estoque. SQL de backfill não passa pelas invalidações da aplicação; avaliar caches administrativos e não mudar status/preço público nessa operação.

## 3. Baseline, aplicação direta ou divisão

**Baseline do Prisma Migrate não é pré-requisito.** O fluxo documentado é SQL manual no Supabase; não há histórico versionado em `prisma/migrations` para aplicar com `prisma migrate deploy`. Não usar `migrate resolve --applied 20261022180400`: isso não cria coluna nem preenche datas e não registra aplicação no fluxo manual atual.

| Estado encontrado | Decisão |
|---|---|
| `Vehicle` e `Sale` existem, chaves/datas válidas, `soldAt` ausente | Aplicar a migração existente dentro de transação e conferir resultados |
| `soldAt` já existe como `timestamp(3)`, nullable, sem default | SQL pode ser reaplicado; revisar previamente o conjunto de nulos com `Sale` que será preenchido |
| Coluna existe com outro tipo/default/nulabilidade | Interromper; `IF NOT EXISTS` não corrige definição. Preparar migração específica, após diagnóstico |
| Tabelas faltantes, duplicatas ou órfãos | Interromper; corrigir o desvio em tarefa própria, sem resetar banco |
| UPDATE excede janela ou gera contenção no ensaio | Dividir DDL e preenchimento em execução controlada; backfill em lotes por IDs revisados, com roteiro versionado próprio |
| Futuro desejo de adotar Prisma Migrate | Projeto separado de baseline completo, incluindo objetos fora do Prisma; não é parte desta liberação |

`ADD COLUMN` exige lock de tabela; nullable sem default evita preenchimento físico de toda a tabela nessa etapa. O UPDATE gera escrita/WAL e locks das linhas alteradas. Envolver ambos em uma transação mantém o lock de DDL até o commit: medir no clone antes de escolher a janela. O PostgreSQL também alerta que `UPDATE ... FROM` com mais de uma correspondência pode escolher uma linha imprevisível; daí a checagem de unicidade. Referências: [ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html), [UPDATE](https://www.postgresql.org/docs/17/sql-update.html).

### Comandos de diff e fotografia inicial, somente em clone local

Sintaxe conferida com `npx --no-install prisma migrate diff --help` do Prisma **6.19.3**. Usar as flags da versão 6; exemplos atuais da versão 7 usam nomes diferentes. Os comandos abaixo geram arquivos para revisão e não aplicam SQL:

```bash
set -euo pipefail
cd /home/lucas/wt/codex
# O arquivo contém apenas credenciais do banco LOCAL de build.
set -a
. /home/lucas/garagem-site/.env.build.local
set +a
node <<'JS'
for (const nome of ['DATABASE_URL', 'DIRECT_URL']) {
  const u = new URL(process.env[nome]);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
      || u.pathname !== '/garagem_build') throw new Error('Destino local inválido');
}
JS
umask 077
npx --no-install prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script --output /tmp/garagem-10222221-drift.sql
# Fotografia DDL do banco efetivo, útil se futuramente for discutido um baseline.
npx --no-install prisma migrate diff \
  --from-empty --to-schema-datasource prisma/schema.prisma \
  --script --output /tmp/garagem-10222221-baseline-candidato.sql
```

O exemplo usa o banco local, não representa uma fotografia de produção por si só. Para diagnosticar produção, primeiro preparar um clone isolado e autorizado com o schema correspondente. Diff Prisma cobre objetos suportados, não substitui dump de schema com políticas, triggers, grants e funções. Não aplicar a saída inteira: pode conter exclusões alheias à tarefa. Caso seja adotado Prisma Migrate futuramente, uma baseline precisa representar o estado **já existente**, ser revisada e ter histórico estabelecido pelo procedimento específico dessa adoção. [Baseline no Prisma 6](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/baselining), [CLI Prisma 6](https://www.prisma.io/docs/orm/v6/reference/prisma-cli-reference#migrate-diff).

## 4. Pré-checagens prontas para o SQL Editor

Executar no ambiente correto, primeiro local, depois preview isolado e finalmente produção pelo responsável. Os blocos desta seção são somente leitura:

```sql
SELECT current_database() AS banco, current_user AS usuario,
       current_schema() AS schema_atual, current_setting('TimeZone') AS fuso;
SELECT to_regclass('public."Vehicle"') AS veiculos,
       to_regclass('public."Sale"') AS vendas,
       to_regclass('public._prisma_migrations') AS historico_prisma,
       to_regclass('supabase_migrations.schema_migrations') AS historico_supabase;

SELECT table_name, column_name, data_type, datetime_precision,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND (
  (table_name = 'Vehicle' AND column_name IN ('soldAt','chassis','renavam'))
  OR (table_name = 'Customer' AND column_name = 'rg')
  OR (table_name = 'Sale' AND column_name IN ('vehicleId','saleDate'))
)
ORDER BY table_name, column_name;

SELECT c.conname, c.convalidated, pg_get_constraintdef(c.oid) AS definicao
FROM pg_constraint c WHERE c.conrelid = 'public."Sale"'::regclass;
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'Sale';
SELECT tgname, pg_get_triggerdef(oid) AS definicao
FROM pg_trigger WHERE tgrelid = 'public."Vehicle"'::regclass AND NOT tgisinternal;

SELECT s."vehicleId", count(*) AS quantidade
FROM public."Sale" s GROUP BY s."vehicleId" HAVING count(*) > 1;
SELECT s.id, s."vehicleId" FROM public."Sale" s
LEFT JOIN public."Vehicle" v ON v.id = s."vehicleId" WHERE v.id IS NULL;
SELECT count(*) AS vendas_sem_data FROM public."Sale" WHERE "saleDate" IS NULL;
SELECT v.status, count(*) AS quantidade FROM public."Vehicle" v GROUP BY v.status;
SELECT count(*) AS vendidos_sem_sale FROM public."Vehicle" v
WHERE v.status = 'vendido'
  AND NOT EXISTS (SELECT 1 FROM public."Sale" s WHERE s."vehicleId" = v.id);
SELECT v.id, v.status, s.id AS venda, s."saleDate"
FROM public."Vehicle" v JOIN public."Sale" s ON s."vehicleId" = v.id
WHERE v.status <> 'vendido';
```

Rodar também `scripts/check-migrations-prod.sql` no SQL Editor, conforme o README. **Limitação:** a lista `alvos` desse script termina no endurecimento de RLS (`scripts/check-migrations-prod.sql:4–53`); não verifica `soldAt`, chassi, RENAVAM ou RG. Um resultado todo verdadeiro não libera esta migração sem as consultas específicas acima.

Verificar tabelas de histórico existentes não significa que estejam preenchidas ou atualizadas. Como o fluxo atual é SQL manual, não criar nem reparar históricos automaticamente; registrar ambiente, versão, horário, executor, contagem afetada e evidências de aplicação no registro operacional.

## 5. Execução por ambiente e reconciliação

### Local → preview → produção

1. **Local:** preparar clone/banco descartável com estrutura anterior; guardar fotografia das datas e dos IDs afetados. Ensaiar ausência da coluna, coluna existente, dupla execução e reaberturas. Banco criado pelo `prisma db push` do CI já possui `soldAt`; isso sozinho não reproduz o incidente de coluna ausente.
2. **Preview isolado:** confirmar que `DATABASE_URL` e `DIRECT_URL` apontam para banco próprio de preview. URL de preview da Vercel não garante isolamento de dados. Se compartilhar produção, não testar gravações ali: provisionar ambiente isolado antes. Aplicar o SQL mantendo a aplicação compatível com `@ignore`.
3. **Reconciliação e código no preview:** conferir as classificações abaixo, ensaiar o plano aprovado de datas, remover `@ignore` e restaurar escritas numa implementação posterior. Regenerar Client e reiniciar processos. Validar venda simples/completa, repetição, cancelamento, reabertura, histórico, alteração de data, troca de veículo e lote. Preservar custos, faturamento, reservas, auditoria e caches.
4. **Produção, etapa de banco:** reconfirmar pré-checagens, backup recuperável, janela e ausência de concorrência nas operações de venda/estoque. O responsável aplica o SQL pelo SQL Editor, ainda com a versão de compatibilidade. Manter operações de escrita suspensas até concluir o corte: enquanto `@ignore` está ativo, novos eventos não atualizam/limpam `soldAt`.
5. **Produção, etapa da aplicação:** repetir reconciliação final imediatamente antes do corte, aprovar todas as exceções e só então publicar a versão com Client regenerado e escritas restauradas. Confirmar a migração em **todos** os bancos atendidos pelo novo Client antes de direcionar tráfego. Merges/deploys ficam com o coordenador.
6. **Após publicar:** liberar escritas, conferir contagens e logs de coluna inexistente (`42703`/P2022), testar leituras do admin sem gerar vendas fictícias em produção e monitorar os primeiros eventos reais. Se a suspensão de escritas não for possível, preparar previamente estratégia de escrita dupla/captura de eventos; não executar o corte concorrente com este roteiro.

### SQL de aplicação

Bloco equivalente ao arquivo canônico, com transação, schema explícito e timeouts de exemplo. Ajustar a janela com o resultado do ensaio. **Não executado remotamente nesta entrega.**

```sql
BEGIN;
SET LOCAL search_path = public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "Vehicle"
  ADD COLUMN IF NOT EXISTS "soldAt" TIMESTAMP(3);

UPDATE "Vehicle" AS vehicle
SET "soldAt" = sale."saleDate"
FROM "Sale" AS sale
WHERE sale."vehicleId" = vehicle."id"
  AND vehicle."status" = 'vendido'
  AND vehicle."soldAt" IS NULL;

COMMIT;
```

Se ocorrer erro/timeout, executar `ROLLBACK` antes de continuar na mesma sessão. Não remover timeouts e repetir indefinidamente; avaliar bloqueadores e separar DDL/backfill se necessário. Guardar a contagem retornada pelo UPDATE. Para execução equivalente **somente local**, após carregar e conferir as variáveis com o bloco da seção 3:

```bash
local_pg_url=${DATABASE_URL%%\?*}
# Backup de ensaio, somente do banco local; manter privado e fora do Git.
umask 077
pg_dump "$local_pg_url" --format=custom \
  --file=/tmp/garagem-10222221-antes.dump
pg_restore --list /tmp/garagem-10222221-antes.dump >/dev/null
# Listar o arquivo não comprova restauração: ensaiar também em outro banco descartável.
psql "$local_pg_url" -X -v ON_ERROR_STOP=1 --single-transaction \
  -c "SET LOCAL search_path = public; SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s';" \
  -f supabase/migrations/20261022180400_veiculo_sold_at.sql
```

### Classificar dados após existir a coluna

```sql
SELECT v.id, v.status, v."soldAt", s.id AS venda, s."saleDate",
  CASE
    WHEN v.status <> 'vendido' AND v."soldAt" IS NOT NULL THEN 'reaberto_com_data'
    WHEN v.status = 'vendido' AND s.id IS NULL AND v."soldAt" IS NULL THEN 'simples_sem_data'
    WHEN v.status = 'vendido' AND s.id IS NOT NULL AND v."soldAt" IS NULL THEN 'backfill_pendente'
    WHEN v.status = 'vendido' AND s.id IS NOT NULL
         AND v."soldAt" IS DISTINCT FROM s."saleDate" THEN 'datas_divergentes'
    ELSE 'sem_divergencia_nessas_regras'
  END AS classificacao
FROM public."Vehicle" v LEFT JOIN public."Sale" s ON s."vehicleId" = v.id
ORDER BY classificacao, v.id;

-- Histórico para revisão. sale.* usa entityId da venda; mudanças de veículo usam id do veículo.
SELECT a."entityId", a.action, a."createdAt", a.changes
FROM public."AdminAudit" a
WHERE a.action IN ('vehicle.status','vehicle.update','sale.create','sale.update','sale.cancel')
ORDER BY a."createdAt", a.id;
```

Política proposta para o plano de reconciliação, a aprovar antes da implementação:

- **Vendido com `Sale`:** `Sale.saleDate` é a referência da venda completa, inclusive histórica. A migração preenche nulos. Datas divergentes exigem revisão por ID; ela não as sobrescreve. Não alterar a data financeira em `Sale` para encaixar a coluna derivada.
- **Vendido sem `Sale`:** pode ser venda simples legítima. Recuperar a última transição efetiva para vendido após a última reabertura, examinando auditorias `vehicle.status` e `vehicle.update` e os cancelamentos relacionados. O endpoint simples registra `changes.status.before/after` e `saleMode: simples`; auditoria de lote também é por veículo. `MAX(createdAt)` de qualquer evento não prova venda. Se faltarem eventos ou houver ambiguidade, manter NULL e registrar exceção, sem fabricar venda, cliente, receita ou data com `now()`, `createdAt` ou `updatedAt`.
- **Não vendido com `soldAt`:** limpar somente após confirmar reabertura/cancelamento e ausência de venda ativa. `sale.cancel` guarda `entityId` da venda e `changes.vehicleId` do veículo (`src/app/admin/vendas/actions.ts:676–680`), portanto não procurar apenas `entityId = Vehicle.id`. Veículo não vendido com `Sale` exige resolver o conflito de negócio primeiro.
- **Revendido:** usar o evento do ciclo atual; não reaproveitar a primeira venda cancelada. Não inferir sequências empatadas pelo ID: ordem estável de exibição não comprova ordem temporal.

Preparar uma lista privada por ID com `status_esperado`, `soldAt_anterior`, `soldAt_proposto`, fonte/evidência e decisão. Aplicar somente linhas aprovadas, numa transação, com comparação do status/data anteriores (`IS NOT DISTINCT FROM` para NULL), verificação de `Sale` e contagem esperada; qualquer divergência aborta. Guardar o inverso por ID para rollback. Sem essa lista revisada, **não executar limpeza global nem backfill a partir de auditorias**. Esse material não deve ser commitado com dados reais de clientes.

`TIMESTAMP(3)` não armazena timezone. Copiar `Sale.saleDate` para a coluna do mesmo tipo não exige conversão. Para datas reconstruídas de auditorias/documentos externos, conferir a convenção do sistema e normalizar uma única vez; não somar/subtrair três horas automaticamente. Registrar exceções sem data comprovada é aceitável porque o campo é nullable.

## 6. Riscos e rollback

| Verificação obrigatória | Risco e resposta |
|---|---|
| Backup com restauração ensaiada antes da escrita | Guardar esquema e dados anteriores; não pressupor PITR disponível no plano contratado |
| Órfãos, duplicatas, datas nulas em `Sale` | Bloquear execução; o SQL não corrige integridade e duplicatas tornam o join ambíguo |
| Vendidos sem `Sale` | Separar vendas simples de inconsistência; NULL não é motivo para inventar faturamento |
| Datas preexistentes divergentes | Migração preserva dados errados também; revisar com origem documentada |
| Reaberturas/cancelamentos durante `@ignore` | Datas ficam obsoletas; reconciliar com escritas suspensas antes do Client novo |
| Triggers, RLS e permissões | Não assumir que ensaio mínimo reproduz produção; conferir efeitos e papel executor |
| Coluna preexistente incompatível | `IF NOT EXISTS` só verifica nome; interromper ao encontrar definição diferente |
| Lock/WAL/tempo | Medir no clone; usar timeout e janela, dividir preenchimento se necessário |
| Rollback por DROP | Apaga datas definitivamente e quebra Client ativo; preferir reverter aplicação mantendo coluna |

Se a migração falhar dentro da transação, `ROLLBACK` desfaz DDL e UPDATE. Se já houve commit, a primeira opção é retornar à **versão de compatibilidade** com `@ignore` e sem escritas de `soldAt`, mantendo a coluna e as datas. Não retornar à base `e7699d9` contra banco sem coluna.

Se uma reconciliação estiver errada, suspender escritas e usar o plano inverso por ID, conferindo que o valor atual ainda é o aplicado; não restaurar snapshot de toda a tabela por cima de vendas novas. Reconciliar novamente antes de reativar o campo. Restaurar banco inteiro fica reservado a incidente com plano de recuperação aprovado.

O arquivo de DROP só deve ser considerado se houver necessidade explícita de remover a coluna, backup das datas e nenhum Client ativo dependente dela. Coluna aditiva sem uso pode permanecer durante rollback; isso evita perda de datas e permite nova tentativa.

## 7. Validação desta análise

Executado localmente no PostgreSQL, via credenciais de `.env.build.local`, depois de validar host de loopback e banco `garagem_build`. Fixtures mínimas criadas no schema exclusivo `codex_migration_10222221`, dentro de uma transação revertida integralmente. Não foi usado o schema público nem dados de produção.

| Ensaio com o SQL canônico | Resultado |
|---|---|
| Coluna ausente e vendido com `Sale` | Coluna criada e data copiada com milissegundos |
| Vendido simples sem `Sale` | Permaneceu NULL |
| Não vendido com `Sale` | Não recebeu data |
| Data existente diferente da venda | Preservada na segunda execução |
| Data obsoleta de reaberto | Preservada; confirma necessidade de reconciliação separada |
| Segunda execução | UPDATE 0; sem erro |
| Integridade das fixtures e `updatedAt` | Quatro veículos e três vendas preservados; timestamps não alterados |
| Rollback canônico | Removeu a coluna; confirma o caráter destrutivo |
| Limpeza do ensaio | ROLLBACK; `to_regnamespace(...) IS NULL` retornou verdadeiro |

Verificações adicionais executadas nesta branch:

| Comando | Resultado |
|---|---|
| `npx --no-install prisma generate` | Client 6.19.3 gerado |
| `npm run lint` | Aprovado |
| `npx --no-install tsc --noEmit` | Aprovado |
| `npx --no-install tsx --test src/lib/admin-sell.test.ts src/lib/admin-sale-integrity.test.ts src/lib/public-stock-revalidate.test.ts` | 27 aprovados, zero falhas |
| `bash scripts/check-migrations.sh origin/main` | Aprovado |
| Dois comandos `prisma migrate diff` da seção 3, contra banco local | Aprovados; diff vazio e fotografia DDL gerada em `/tmp`, sem aplicação |
| Blocos Bash do relatório com `bash -n` | Sintaxe aprovada |
| Pré-checagens e classificação SQL do relatório | Executadas com sucesso em transação local `READ ONLY` |

Esse ensaio prova o comportamento do SQL com fixtures mínimas, não mede lock sob carga, triggers reais, volume/WAL ou o estado dos bancos remotos. Build completo e suíte completa não executados; foram usados testes relevantes à área e o build ficou reservado ao CI, conforme a regra final da tarefa. Nenhuma tela pública foi alterada.

Documentação oficial consultada em 22/10/2026: [changelog Supabase](https://supabase.com/changelog), [migrações Supabase](https://supabase.com/docs/guides/deployment/database-migrations), referências Prisma 6 e PostgreSQL 17 citadas acima. O fluxo de automação descrito na documentação geral do Supabase não substitui a regra local de SQL manual em produção.

## 8. Tarefas prontas para implementação

| Prioridade | Impacto × esforço | Tarefa e critério de aceite |
|---|---|---|
| P0 | Alto × baixo | Coordenador consolidar a compatibilidade do PR #370; admin funciona sem a coluna, antes de liberar reativação |
| P1 | Alto × baixo | Responsável inventariar cada banco e registrar pré-checagens, DDL, chaves, triggers e backup; nenhuma suposição baseada só no Git |
| P1 | Alto × médio | Ensaiar e aplicar 20261022180400 na ordem local → preview isolado → produção; registrar linhas e duração; manter compatibilidade |
| P1 | Alto × médio | Preparar e aprovar plano por ID das vendas simples, divergências e reaberturas; exceções sem prova ficam NULL; rollback inverso disponível |
| P1 | Alto × médio | Restaurar gravações e remover `@ignore` na base consolidada; preservar datas em repetição e limpar ao reabrir; nenhum banco atendido sem a coluna |
| P1 | Alto × médio | CI e E2E da implementação cobrirem ambos os fluxos, cancelamento/reabertura/revenda, histórico, troca, edição de data, lote e caches; build no CI |
| P2 | Médio × baixo | Acrescentar `soldAt`, chassi, RENAVAM e RG ao verificador de migrações e testar implantação partindo de coluna ausente |

Decisão final: **aplicação direta condicionada à inspeção, com reconciliação e publicação separadas; sem baseline Prisma nesta tarefa**. As etapas de banco remoto e código acima são trabalho futuro autorizado pelo responsável, não operações realizadas por este relatório.
