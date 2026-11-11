# Runbook: migrations SQL (`supabase/migrations`)

## Quando usar

PR que adiciona ou altera arquivo em `supabase/migrations/`.

## Regras

- **Única** pasta oficial de SQL: `supabase/migrations/` (rollback em `supabase/rollback/`).
- CI job `migrations` aplica o SQL **duas vezes** em Postgres descartável — deve ser idempotente ou ordenado.
- **Agentes não aplicam** em produção. Lucas/ops aplica no Supabase Dashboard ou fluxo combinado.

## Passos locais (desenvolvedor)

1. Ler `supabase/README.md`.
2. `prisma db push` para schema Prisma; SQL manual para RLS, índices, funções extras.
3. Rodar localmente o que o CI roda: `scripts/check-migrations.sh`, `scripts/ci-apply-migrations.sh` (se existirem no repo).
4. No PR: descrever impacto (tabelas novas, RLS, downtime).

## Nunca

- `prisma db push` apontando para `DATABASE_URL` de produção.
- Alterar privacidade de bucket Storage sem revisão de segurança.
