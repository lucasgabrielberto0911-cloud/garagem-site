# supabase

- `migrations/`: **única** pasta de migrations. Nome `AAAAMMDDHHMMSS_slug_em_snake_case.sql`, aplicadas em ordem alfabética e escritas de forma idempotente (`IF NOT EXISTS`, `DROP ... IF EXISTS` antes de `ADD CONSTRAINT`).
- `rollback/`: desfaz uma migration, com o mesmo nome do arquivo. Obrigatório para migration nova destrutiva (DROP TABLE/COLUMN, TRUNCATE, DELETE, REVOKE).
- `legacy/`: scripts avulsos já substituídos (ver README da pasta).

O schema do Prisma continua sendo a fonte da forma das tabelas. Em produção as migrations são aplicadas **à mão** (SQL Editor do Supabase), nunca por `prisma db push`/`migrate`. Antes, rode `scripts/check-migrations-prod.sql` (só leitura) para ver o que já existe.

## Validação (CI, job `migrations`)
1. `scripts/check-migrations.sh <base>`: padrão de nome, versão duplicada e rollback das migrations novas.
2. Postgres 17 de serviço, `prisma db push`, depois `scripts/ci-apply-migrations.sh`: cria `anon`/`authenticated` e um `storage.objects` mínimo, aplica todas as migrations em ordem **duas vezes** (garante idempotência) e confere com `check-migrations-prod.sql`.

Local: crie um banco descartável, exporte `DATABASE_URL`/`DIRECT_URL`, rode `npx prisma db push` e `scripts/ci-apply-migrations.sh`.
