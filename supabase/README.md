# supabase

- `migrations/`: **única** pasta de migrations. Nome `AAAAMMDDHHMMSS_slug_em_snake_case.sql`, aplicadas em ordem alfabética e escritas de forma idempotente (`IF NOT EXISTS`, `DROP ... IF EXISTS` antes de `ADD CONSTRAINT`).
- `rollback/`: desfaz uma migration, com o mesmo nome do arquivo. Obrigatório para migration nova destrutiva (DROP TABLE/COLUMN, TRUNCATE, DELETE, REVOKE).
- `legacy/`: scripts avulsos já substituídos (ver README da pasta).

O schema do Prisma continua sendo a fonte da forma das tabelas. Em produção as migrations são aplicadas **à mão** (SQL Editor do Supabase), nunca por `prisma db push`/`migrate`. Antes, rode `scripts/check-migrations-prod.sql` (só leitura) para ver o que já existe.

## Validação (CI, job `migrations`)
1. `scripts/check-migrations.sh <base>`: padrão de nome, versão duplicada e rollback das migrations novas.
2. Postgres 17 de serviço, `prisma db push`, depois `scripts/ci-apply-migrations.sh`: cria `anon`/`authenticated` e um `storage.objects` mínimo, aplica todas as migrations em ordem **duas vezes** (garante idempotência) e confere com `check-migrations-prod.sql`.

Local: crie um banco descartável, exporte `DATABASE_URL`/`DIRECT_URL`, rode `npx prisma db push` e `scripts/ci-apply-migrations.sh`.

## Reativação de `Vehicle.soldAt` (20261022180400)

O Prisma Client volta a ler e gravar `soldAt`, inclusive em consultas sem `select`.
Antes de publicar essa versão, o responsável pelo banco deve validar a migração
em **cada ambiente** (desenvolvimento, staging/preview e produção). A ausência da
coluna derruba consultas do painel. Este procedimento não autoriza execução em produção.

1. Com autorização do responsável, aplique `migrations/20261022180400_veiculo_sold_at.sql`
   pelo procedimento do ambiente (em produção, SQL Editor). Ela é idempotente e
   preenche a data das vendas existentes com `Sale.saleDate`.
2. Confira a coluna com a consulta abaixo. Deve haver uma linha com
   `timestamp without time zone`, precisão 3 e `is_nullable = YES`.
3. Com `DATABASE_URL` exportada para o ambiente correto, execute
   `npx tsx prisma/scripts/reconcile-soldAt.ts`. Host remoto é bloqueado por padrão;
   após autorização separada, o operador precisa definir
   `ALLOW_REMOTE_RECONCILE_SOLD_AT=true`. O script não carrega arquivos `.env`.
4. A reconciliação prefere `Sale.saleDate` e, sem venda, usa `Vehicle.updatedAt`
   como estimativa (a data exata de vendas simples antigas não é recuperável).
   Limpa datas de veículos reabertos, preserva datas já preenchidas e `updatedAt`.
   As duas correções são uma única transação; falhas revertem ambas e não imprimem
   contagens de sucesso. Execute em janela sem gravações concorrentes no estoque.
5. Confira as contagens abaixo e repita o script: as duas contagens de alterações
   devem ser zero na segunda execução. Só depois libere a publicação do Client
   reativado e valide venda simples/completa, edição de data e cancelamento.

```sql
SELECT data_type, datetime_precision, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Vehicle' AND column_name = 'soldAt';

SELECT status, COUNT(*) FROM "Vehicle" GROUP BY status;
SELECT COUNT(*) AS inconsistencias FROM "Vehicle"
WHERE (status = 'vendido' AND "soldAt" IS NULL)
   OR (status <> 'vendido' AND "soldAt" IS NOT NULL);
-- Esperado: uma linha com inconsistencias = 0. O status é minúsculo no banco.
```

Para validar localmente, use as URLs de `.env.build.local` com um schema isolado
`reconcile_soldat_test_<nome>` nas duas URLs. Confira que ambos os hosts são locais.
Rode `npx prisma validate`, `npx prisma db push --skip-generate`,
`npx prisma generate` e `npx tsx prisma/seed.ts` (o seed recria os exemplos).
Depois rode `npx tsx --test prisma/scripts/reconcile-soldAt.test.ts` e o script.
O teste cobre fallback, venda histórica, data preservada, reabertura, idempotência,
rollback após falha na segunda atualização e bloqueio de host remoto.

Se precisar reverter a aplicação, publique primeiro um Client que ignore a coluna.
Mantenha a coluna e os dados; o rollback que remove `soldAt` é destrutivo e exige
autorização própria. Não remova a coluna enquanto houver instâncias que a consultem.
