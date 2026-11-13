# Ambiente do agente (local e cloud)

IAs costumam pular `npm run check` ou `build` por causa do `.env` do humano. Este runbook explica o que é seguro.

**Nunca** rode `prisma db push`, migrate, seed ou e2e contra o banco de **produção**.

## `DATABASE_URL` / `DIRECT_URL`

| Host | Pode? |
| --- | --- |
| `127.0.0.1` ou `localhost` | Sim (dev / e2e / CI) |
| `*.supabase.co`, pooler, IP de produção | **Não** — pare |
| Ausente | `npm test` e lint ok; `next build` pode falhar no prerender (`/modelos` etc.) |

Se a URL não for local: não rode `check:build`, `db:push`, `e2e:seed` nem `test:e2e`. Diga isso no PR. Use `E2E_TEST=1` só com banco local.

## `R2_*`

Quatro variáveis (`R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_URL`, `R2_API_TOKEN`).

- Completas no cloud agent: alguns testes de Storage **desviam o mock** e podem falar com o bucket real. O teste `gallery-preview.test.ts` isola essas variáveis; outros testes de upload devem fazer o mesmo.
- Ausentes: upload de galeria cai no caminho legado (Supabase) nos testes que mockam o SDK — esperado.
- Incompletas: `getR2Config()` lança erro de configuração (teste em `r2-photos.test.ts`).

Não use as credenciais reais para “conferir” foto. Fixture: `public/branding/placeholder-car.png`.

## `npm run check` vermelho

| Sintoma | Causa típica |
| --- | --- |
| `gallery-preview` / upload falha com R2 | Env R2 do humano no processo; isolar no teste |
| `agregador do CI espera migrations` | O job `check` aceita `success` **ou** `skipped`; não volte o `!= "success"` |
| `rg: command not found` no footguns | O script usa GNU `grep` (não ripgrep) |
| Prisma `ENOTFOUND` / tenant not found no **build** | `DATABASE_URL` de produção ou inválida — não é falha do seu diff |
| E2E `seo-modelos-funil` com 2 `noindex` | Metadata extra no `not-found.tsx` |

## Sem banco local

Válido no cloud: `npm test`, `npm run lint`, `bash scripts/check-footguns.sh`, `npx tsc --noEmit`. Marque no PR que o build ficou para o CI.

## Fotos

Agentes **não** fazem `curl`/`wget` em `suagaragem.net/fotos`, Storage ou `supabase.storage.download`. Ver `AGENTS.md` seção de egress.
