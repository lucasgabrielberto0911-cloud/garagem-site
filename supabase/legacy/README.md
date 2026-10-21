# supabase/legacy

Scripts avulsos que **não** fazem parte da sequência de `supabase/migrations`.

| Arquivo | Situação |
|---|---|
| `admin-access-hardening.sql` | Antigo `prisma/sql/admin-access-hardening.sql`. Substituído por `migrations/20261021000100_rls_hardening.sql` (RLS, REVOKE e remoção das políticas `Public ... veiculos` do storage). Fica só como histórico; **não aplique**. |

Regra: `supabase/migrations` é a única pasta de migrations. Nada novo entra aqui.
