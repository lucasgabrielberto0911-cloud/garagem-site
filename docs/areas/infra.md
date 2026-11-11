# Área: infra — CI, Vercel, scripts

## Escopo

| Item | Arquivo |
| --- | --- |
| Deploy / região | `vercel.json` (`gru1`) |
| Ignorar preview | `scripts/vercel-ignore.sh` |
| CI | `.github/workflows/ci.yml` |
| Migrations check | `scripts/check-migrations.sh`, `scripts/ci-apply-migrations.sh` |
| Prisma schema | `prisma/schema.prisma` |
| SQL oficial | `supabase/migrations/` |
| Cron | `src/app/api/cron/` (ex.: reservas) |
| Proxy | `src/proxy.ts` |

## Regras

1. **Functions em `gru1`** alinhadas ao Supabase `sa-east-1` — mudar região só com mudança de banco (`docs/ops.md`).
2. **Hobby:** economia de deploys (`preview` sob demanda); não aumentar ISR sem motivo.
3. Migrations: CI aplica 2×; produção aplica humano (`runbooks/migrations-supabase.md`).
4. Novas rotas `force-dynamic`: exceção justificada (feed Meta é caso já aceito — ver [`api-meta.md`](api-meta.md)).
5. Não commitar secrets; não alterar env Vercel via agente.

## Testes locais antes de PR infra

```bash
npm test && npm run lint && npm run build
# Se mexeu em SQL:
# scripts do job migrations (ver ci.yml)
```

## Erros comuns de IA

- `prisma db push` em URL de produção.
- Remover `ignoreCommand` “para sempre buildar preview”.
- Adicionar dependência pesada a rotas leves (`/api/health`, `/api/estoque`).
