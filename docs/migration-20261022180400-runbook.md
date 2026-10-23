# Runbook — ativação de Vehicle.soldAt por ambiente

Data: 22/10/2026. Operação planejada; **produção ainda não autorizada nem executada**.
Responsáveis: Lucas aprova a operação; coordenador organiza publicação e reversão; operador autorizado aplica SQL.

## Escopo e dependências

A coluna deve existir e os dados devem estar reconciliados **antes do build/deploy da aplicação que remove `@ignore`**. A ordem é: congelar gravações → backup → migration → reconciliação → validar → publicar → fumaça → liberar gravações.

Arquivos efetivos (já versionados, sem duplicatas):

- Migration: `supabase/migrations/20261022180400_veiculo_sold_at.sql`.
- Rollback: `supabase/rollback/20261022180400_veiculo_sold_at.sql` (não existe um segundo arquivo `_rollback.sql`).
- Schema e implementação: [PR #374](https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/374).
- Script no PR #374: `prisma/scripts/reconcile-soldAt.ts`; teste: `prisma/scripts/reconcile-soldAt.test.ts`. Não criar `scripts/reconcile-sold-at-dates.ts` paralelo.

Este runbook complementa o PR #374. Na base desta documentação, `soldAt` ainda tem `@ignore` e o script ainda depende daquele PR. O coordenador deve integrar ambos no mesmo candidato de release **sem publicar automaticamente a reativação antes do banco**. Não executar o script se ele estiver ausente ou se o Client ainda ignorar o campo.

A migration adiciona `TIMESTAMP(3)` anulável e preenche vendidos com `Sale.saleDate`. O script completa vendidos sem data usando `Sale.saleDate`, ou `Vehicle.updatedAt` como **estimativa**, limpa `soldAt` de todos os não vendidos (inclusive reabertos/reservados) e preserva datas já preenchidas e `updatedAt`. Não substitui uma data existente divergente de `Sale.saleDate`: Lucas deve revisar divergências antes da liberação. Não inferir data histórica exata a partir de `updatedAt`.

## Ferramenta correta e credenciais

Conforme `supabase/README.md`, as migrations remotas são aplicadas manualmente no SQL Editor do Supabase, em ordem, após `scripts/check-migrations-prod.sql` (somente leitura). `prisma migrate deploy` procura migrations do Prisma; **não aplica estes arquivos de `supabase/migrations`**. Não usá-lo nesta operação. `prisma db push` é permitido apenas para preparar banco local descartável; nunca em preview remoto ou produção. A publicação da Vercel não aplica SQL automaticamente.

Use terminais separados por ambiente, sem `set -x`, sem imprimir URLs, sem salvar credenciais no repo/log/PR. Os arquivos remotos abaixo são provisionados pelo operador em `/home/lucas/.config/garagem/`, com modo 600; não são criados nem baixados por este runbook. Não alterar variáveis na Vercel nesta tarefa. Conferir no painel, por leitura, que o deployment usa o projeto e banco pretendidos. Para SQL e reconciliação remotos, `DIRECT_URL` deve ser uma conexão PostgreSQL direta aprovada, não o pool transacional.

A reconciliação exige janela **sem gravações concorrentes** de admin, APIs de venda/reabertura e automações, desde o backup até o término da fumaça. Combine a suspensão operacional com todos os operadores; se não for possível garantir, adie. Não há bloqueio global implementado pelo script.

## 1. Ensaio local — VM, PostgreSQL 16

Executar na raiz do candidato com o PR #374 integrado. Requer dependências já instaladas. O schema exclusivo evita afetar `garagem_build.public`:

```bash
set -euo pipefail
set -a
. /home/lucas/garagem-site/.env.build.local
set +a
export DATABASE_URL="$(node <<'JS'
const u = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) throw Error('Banco não local');
u.searchParams.set('schema', 'reconcile_soldat_test_runbook');
process.stdout.write(u.href);
JS
)"
export DIRECT_URL="$DATABASE_URL"
# psql não aceita o parâmetro Prisma schema: separar URL e search_path.
export RUNBOOK_PSQL_URL="$(node -e 'const u=new URL(process.env.DIRECT_URL);u.searchParams.delete("schema");process.stdout.write(u.href)')"
export PGOPTIONS='-c search_path=reconcile_soldat_test_runbook'
unset ALLOW_REMOTE_RECONCILE_SOLD_AT
npx prisma validate
npx prisma db push --skip-generate
npx prisma generate
# db push já cria a coluna no candidato; removê-la só neste schema descartável
# permite testar a migration contra o estado anterior.
psql "$RUNBOOK_PSQL_URL" -X -v ON_ERROR_STOP=1 -1 -f supabase/rollback/20261022180400_veiculo_sold_at.sql
psql "$RUNBOOK_PSQL_URL" -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261022180400_veiculo_sold_at.sql
psql "$RUNBOOK_PSQL_URL" -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261022180400_veiculo_sold_at.sql
npx tsx --test prisma/scripts/reconcile-soldAt.test.ts
npx tsx prisma/scripts/reconcile-soldAt.ts
npx tsx prisma/scripts/reconcile-soldAt.ts
npm run lint
npx tsc --noEmit
npm test
```

O teste cria seis veículos sintéticos: vendido sem venda histórica, vendido com venda, vendido com data preservada, disponível/reaberto e reservado com data indevida e disponível sem data. Confere datas, preservação de `updatedAt`, idempotência, reversão transacional em erro e bloqueio de host remoto. A segunda execução do script deve informar zero correções. O teste limpa seus registros; para fumaça de navegador, preparar fixtures locais identificáveis de vendido e reaberto e anotar IDs/slugs (não usar anúncios reais).

Executar as queries da seção 4 e ensaiar também o rollback da seção 6 neste schema. Para testar a aplicação local, manter estas variáveis e iniciar `npm run dev` em outro terminal; não apontar o servidor local para produção.

## 2. Preview — Vercel Preview Deployments

Pré-condição: banco de preview separado, com dados sintéticos/anonimizados e tabelas anteriores já migradas. **Se preview compartilhar o banco de produção, interromper esta etapa**: não existe ensaio isolado. Conferir projeto Supabase, branch de banco (se houver), host, database e schema com Lucas, sem publicar credenciais.

No terminal exclusivo de preview:

```bash
set -euo pipefail
set -a
. /home/lucas/.config/garagem/preview.env
set +a
: "${DATABASE_URL:?}" "${DIRECT_URL:?}"
unset PGOPTIONS ALLOW_REMOTE_RECONCILE_SOLD_AT
npx prisma validate
npx prisma generate
```

O operador autorizado, no SQL Editor **do projeto de preview**, executa o conteúdo versionado, nesta ordem:

1. `scripts/check-migrations-prod.sql`; confirmar pré-requisitos e coluna ausente/presente.
2. Queries de identidade e backup da seção 3 (se a coluna já existe, incluir `soldAt` no backup).
3. `supabase/migrations/20261022180400_veiculo_sold_at.sql`, envolvido em `BEGIN; SET LOCAL search_path TO public;` e `COMMIT;`.
4. Queries da seção 4 para registrar o estado antes da reconciliação.

Após autorização específica para o banco remoto de preview:

```bash
# Escopo só do processo, sem persistir o opt-in ou imprimir credenciais.
DATABASE_URL="$DIRECT_URL" ALLOW_REMOTE_RECONCILE_SOLD_AT=true npx tsx prisma/scripts/reconcile-soldAt.ts
DATABASE_URL="$DIRECT_URL" ALLOW_REMOTE_RECONCILE_SOLD_AT=true npx tsx prisma/scripts/reconcile-soldAt.ts
```

Repetir seção 4: inconsistências devem zerar. Só então o coordenador solicita o preview final do candidato (label `preview` no PR agregado ou commit `[preview]`, uma única vez) e executa a seção 5 na URL desse deployment. Conferir o commit publicado e os logs sem erros de coluna ausente (`P2022`). Não disparar preview deste PR documental isoladamente.

## 3. Produção — aprovação e preparação

**Esta seção descreve uma operação futura do operador autorizado. Não é autorização para o Codex executá-la.** Banco Supabase sa-east-1, aplicação Vercel Production em gru1. Registrar data, operador, commit atual com `@ignore`, commit candidato, URL do preview aprovado e deployment anterior para reversão.

Checklist a ser aprovado expressamente pelo Lucas antes de qualquer escrita em produção:

- [ ] PR #374 e runbook revisados; CI do candidato verde (testes, lint, tipos, build e E2E).
- [ ] Ensaio local de reconciliação e rollback aprovado; preview isolado passou a fumaça.
- [ ] Confirmados projeto, host, database e schema de produção; todos os ambientes atendidos inventariados (inclusive previews antigos que compartilham banco).
- [ ] Lista de vendidos/reabertos revisada, incluindo datas estimadas e divergências; política de fallback `updatedAt` aceita.
- [ ] Backup restaurável, caminho protegido e procedimento de restauração conferidos pelo operador.
- [ ] Janela sem gravações, responsáveis, duração e critério de interrupção combinados.
- [ ] Lucas autorizou explicitamente: migration, reconciliação remota, publicação e eventual rollback; registrar aprovação no PR/tarefa, sem credenciais.

Terminal exclusivo de produção, **somente pelo operador após aprovação**:

```bash
set -euo pipefail
set -a
. /home/lucas/.config/garagem/production.env
set +a
: "${DATABASE_URL:?}" "${DIRECT_URL:?}"
unset PGOPTIONS ALLOW_REMOTE_RECONCILE_SOLD_AT
npx prisma validate
npx prisma generate
```

No SQL Editor do projeto confirmado, conferir identidade e estado (não prova ambiente sozinha; confrontar com o painel):

```sql
SET search_path TO public;
SELECT current_database(), current_schema(), current_user;
SELECT column_name, data_type, datetime_precision, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Vehicle' AND column_name = 'soldAt';
```

Executar `scripts/check-migrations-prod.sql`. Parar se faltarem pré-requisitos. Com gravações suspensas, obter snapshot/backup restaurável conforme recursos do projeto; não presumir PITR disponível. Guardar também export restrito desta consulta **antes de aplicar a migration**, e registrar se `soldAt` já existia:

```sql
-- Funciona também quando a coluna ainda não existe.
SELECT v."id", v."status", v."updatedAt", to_jsonb(v)->>'soldAt' AS "soldAtAnterior",
       s."saleDate"
FROM "Vehicle" v LEFT JOIN "Sale" s ON s."vehicleId" = v."id"
ORDER BY v."id";
```

Exportar o resultado apenas para armazenamento privado aprovado, nunca para git/PR. Se não houver backup restaurável, parar. Executar a migration versionada no SQL Editor dentro de `BEGIN; SET LOCAL search_path TO public; ... COMMIT;`. Em falha, `ROLLBACK;`, registrar erro sem segredos e não publicar aplicação.

**Reconciliação antes do deploy da aplicação**, depois da criação da coluna:

```bash
DATABASE_URL="$DIRECT_URL" ALLOW_REMOTE_RECONCILE_SOLD_AT=true npx tsx prisma/scripts/reconcile-soldAt.ts
DATABASE_URL="$DIRECT_URL" ALLOW_REMOTE_RECONCILE_SOLD_AT=true npx tsx prisma/scripts/reconcile-soldAt.ts
```

Validar seção 4 e obter aceite dos valores estimados. Só então o coordenador promove/publica o commit aprovado pelos meios habituais. Não executar merge nesta tarefa. Regenerar Prisma Client faz parte do build (`npm run build`), não altera o banco. Manter a coluna para compatibilidade com deployments antigos que ainda a ignoram.

## 4. Validações de schema e dados — cada ambiente

No candidato: `rg -n 'soldAt' prisma/schema.prisma` deve mostrar `DateTime?` sem `@ignore`; `npx prisma validate` e `npx prisma generate` devem passar. A query de `information_schema` acima deve devolver uma coluna `timestamp without time zone`, precisão 3, anulável.

Executar no schema correto (local usa o `PGOPTIONS` da seção 1; no SQL Editor remoto, iniciar cada lote com `SET search_path TO public;`):

```sql
SELECT count(*) AS total,
       count(*) FILTER (WHERE "soldAt" IS NULL) AS sold_at_nulos,
       count(*) FILTER (WHERE "status" = 'vendido' AND "soldAt" IS NULL) AS vendidos_sem_data,
       count(*) FILTER (WHERE "status" <> 'vendido' AND "soldAt" IS NOT NULL) AS nao_vendidos_com_data
FROM "Vehicle";

SELECT v."id", v."status", v."soldAt", v."updatedAt", s."saleDate",
       CASE WHEN s."id" IS NULL THEN 'sem venda: revisar estimativa updatedAt'
            ELSE 'com venda histórica' END AS origem
FROM "Vehicle" v LEFT JOIN "Sale" s ON s."vehicleId" = v."id"
WHERE v."status" = 'vendido'
ORDER BY v."id";

SELECT v."id", v."soldAt", s."saleDate"
FROM "Vehicle" v JOIN "Sale" s ON s."vehicleId" = v."id"
WHERE v."status" = 'vendido' AND v."soldAt" IS DISTINCT FROM s."saleDate";
```

Aceite: `vendidos_sem_data = 0` e `nao_vendidos_com_data = 0`. `sold_at_nulos` pode ser maior que zero: disponíveis/reservados devem ter null. Comparar total, IDs, status e `updatedAt` com o backup; devem permanecer iguais. Conferir individualmente os reabertos conhecidos (status atual não vendido, `soldAt IS NULL`); o banco não tem um status específico “reaberto”. Revisar divergências da terceira query sem sobrescrever datas automaticamente. Na segunda execução do script, ambas as contagens de correção precisam ser zero.

## 5. Fumaça depois do deploy

Definir a origem do ambiente e os IDs/slugs conhecidos, sem credenciais em comandos públicos:

```bash
export RUNBOOK_BASE_URL='http://localhost:3000' # trocar pela URL do preview/produção em cada etapa
curl --fail-with-body -sS "$RUNBOOK_BASE_URL/api/estoque?page=1" | node -e '
let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{
 const r=JSON.parse(s);if(r.error||!Array.isArray(r.vehicles)||typeof r.total!=="number")process.exit(1);
 console.log("API estoque: formato válido");});'
```

- `/api/estoque`: HTTP 200, paginação coerente, disponível/reaberto visível quando elegível; vendido fora do estoque disponível. Conferir IDs e valores esperados, não aceitar estoque vazio como prova suficiente.
- Ficha vendida pelo slug canônico: HTTP 200, aviso de vendido, título com “(vendido)”, `noindex, follow`, sem preço na tela, JSON-LD ou WhatsApp. Ficha reaberta: disponível, preço e CTA corretos.
- Chat na ficha vendida: perguntar “Esse veículo ainda está disponível?” e “Qual o preço dele?”. Deve informar venda sem preço antigo e oferecer alternativas disponíveis. **O chat atual não seleciona `soldAt`** (`src/lib/chat-stock-cache.ts`), portanto não exigir data da venda nem inventá-la. Validar datas pelo SQL. No reaberto, confirmar disponibilidade, sem resposta antiga de vendido.
- Local/preview: pelo admin, vender fixture e confirmar `soldAt` preenchido; reabrir e confirmar null, ficha, API e chat atualizados após invalidação. Não criar vendas fictícias em produção; acompanhar somente operação real autorizada.
- Conferir logs do deployment: sem `P2022`, erros de Prisma ou falhas 500. SQL/script não invalidam cache; não tomar uma resposta cacheada como validação dos dados. Validar após a nova publicação e invalidação habitual pelo admin; se persistir cache antigo, aguardar TTL aplicável (estoque até 3600 s, chat atual 600 s e CDN da API 120 s + stale 300 s) sem liberar a janela até comprovar o estado esperado. Não chamar `updateTag` fora de Server Actions.

Registrar URL/commit, horário, contagens, IDs de teste e resultado, sem dados pessoais/segredos. Se qualquer item falhar, manter suspensão de gravações e seguir reversão; liberar somente após aceite operacional.

## 6. Rollback e ensaio

Preferir **reverter a aplicação e manter a coluna**, pois adicionar coluna anulável é compatível com o código anterior que usa `@ignore`. Primeiro restaurar o deployment anterior conhecido, cujo Client ignora `soldAt`, e conferir saúde, ficha/API/chat. Impedir que previews/jobs ainda usando o Client novo acessem banco cuja coluna será removida. Só depois considerar rollback SQL, com aprovação separada para perda das datas.

O arquivo de rollback **remove a coluna e todas as datas**, inclusive as corrigidas e as já existentes; não restaura dados. Não executá-lo para “desfazer somente a reconciliação”. Se a coluna existia antes, preservar e restaurar datas a partir do backup validado, com operador e SQL de restauração revisado por registro; não preencher novamente por estimativa e chamar isso de restauração. Se houve novas vendas depois da janela, conciliar esses registros antes de restaurar; não restaurar snapshot integral cegamente.

Ensaio local, no mesmo terminal/schema descartável da seção 1, sem app em execução:

```bash
psql "$RUNBOOK_PSQL_URL" -X -v ON_ERROR_STOP=1 -1 -f supabase/rollback/20261022180400_veiculo_sold_at.sql
psql "$RUNBOOK_PSQL_URL" -X -v ON_ERROR_STOP=1 -c "SELECT count(*) AS coluna_restante FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Vehicle' AND column_name = 'soldAt';"
# Esperado: 0. Testar reaplicação e reconciliação antes de retomar o app candidato.
psql "$RUNBOOK_PSQL_URL" -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261022180400_veiculo_sold_at.sql
npx tsx prisma/scripts/reconcile-soldAt.ts
npx tsx prisma/scripts/reconcile-soldAt.ts
```

Em preview/produção, o operador executa o conteúdo do rollback versionado no SQL Editor, em `BEGIN; SET LOCAL search_path TO public; ... COMMIT;`, **apenas após reversão da aplicação e aprovação**. Confirmar ausência da coluna e fumaça com Client antigo. Registrar execução/reversão no controle operacional; não inventar registros em `_prisma_migrations` nem reparar histórico Supabase sem verificar o mecanismo realmente usado. Uma nova tentativa exige repetir backup, migration, reconciliação e validação antes de publicar Client novo.

## Evidência desta entrega

Ensaio realizado em 22/10/2026 no PostgreSQL local da VM, schema descartável `reconcile_soldat_test_runbook_10222221`, removido ao concluir. Script, teste e schema do PR #374 foram extraídos do commit `12342c32a530aa3573638a1ed7c048d0b58e2ca4` em arquivos temporários; a implementação não foi duplicada nesta branch. O Client original foi regenerado depois do ensaio.

- Migration aplicada duas vezes: sucesso, segunda execução com coluna já existente.
- Teste de reconciliação: 1 teste passou, cobrindo os seis cenários, idempotência, falha transacional e rejeição de host remoto.
- Duas execuções adicionais do script: zero correções.
- Rollback SQL local: coluna ausente (`coluna_restante = 0`); reaplicação da migration e reconciliação concluídas. Ensaio SQL adicional em schema descartável mínimo, com dois veículos e duas vendas históricas, confirmou backfill apenas do vendido, idempotência, preservação dos registros ao remover a coluna e recuperação da data histórica ao reaplicar. As asserções SQL passaram e o schema adicional foi removido.
- Queries finais: `vendidos_sem_data = 0`, `nao_vendidos_com_data = 0`. Essas contagens finais foram feitas após a limpeza das fixtures pelo teste; a validação das datas não vazias está nas asserções do teste.

Sintaxe dos sete blocos Bash conferida com `bash -n`; `git diff --check` e `bash scripts/check-migrations.sh origin/main` passaram. `npx tsc --noEmit` e `npm run lint` passaram. A primeira execução de `npm test` teve 1 falha em 1.439 testes porque foi iniciada enquanto o ensaio usava o Client do PR #374: o teste da base exige `soldAt` ignorado. Após regenerar o Client da base, `npx tsx --test src/lib/admin-sell.test.ts` passou (4/4); a repetição de `npm test`, sem geração concorrente do Client, passou com **1.439/1.439 testes** (138,6 s). Build completo reservado ao CI do PR agregado conforme a tarefa; esta branch documental não abre PR próprio. Fumaça de navegador, preview, produção e aprovação do Lucas **pendentes**. A documentação não autoriza executar a operação em produção.

Referências: `supabase/README.md`, migration/rollback acima, PR #374, `src/lib/chat-stock-cache.ts` e [documentação Supabase sobre migrations](https://supabase.com/docs/guides/deployment/database-migrations). Consultado o [changelog Supabase](https://supabase.com/changelog.md) em 22/10/2026; a alteração TLS anunciada para APIs HTTP não muda a sequência SQL deste runbook.
