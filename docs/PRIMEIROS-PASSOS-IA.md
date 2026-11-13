# Primeiros passos — IA neste repo

Leitura de **dois minutos** antes de abrir arquivos. Regras completas: [`AGENTS.md`](../AGENTS.md). Mapa: [`GUIA-PARA-IAS-E-DESENVOLVEDORES.md`](GUIA-PARA-IAS-E-DESENVOLVEDORES.md).

## Loop de toda tarefa

1. `gh pr list` e `bash scripts/agentes-conflitos.sh` (ou `npm run agentes:conflitos`). Área já ocupada → pare e avise o Lucas / Grok Bot.
2. Branch `cursor/<tema>`, `claude/<tema>` ou `agy/<tema>` (Codex: só `docs/pesquisas/`).
3. Leia o guia da área em [`areas/`](areas/) e [`ANTI-PATTERNS.md`](ANTI-PATTERNS.md) **antes** do commit.
4. `npm run check` (e `check:build` se mexeu em tela). Banco: só local (`127.0.0.1`). Fotos: fixture, nunca produção.
5. Draft PR em português. **Não** mergeie a `main`. Preview Vercel: label `preview` só no teste final.

Quadro paralelo Claude/Antigravity: [`.agentes/em-andamento.md`](../.agentes/em-andamento.md).

## O que nunca fazer

| Não | Sim |
| --- | --- |
| `revalidatePath("/estoque/[id]", "page")` | `revalidatePublicStock()` |
| Preço em veículo **vendido** | Sem preço em ficha, card, JSON-LD, chat, WhatsApp |
| Cidade do veículo no site público | Só no admin |
| Texto novo "Sua Garagem" | Marca **Garagem** |
| `buildPageMetadata({ noIndex })` no `not-found.tsx` | Só `title` + `description` (o Next já manda `noindex`) |
| Download de `/fotos` ou Storage de produção | `public/branding/placeholder-car.png` + `page.route` |
| `prisma db push` / seed na URL de produção | Postgres local ou job CI |
| Segundo PR na mesma **área** | Esperar o Draft da área fechar |

## Comandos

```bash
gh pr list
bash scripts/agentes-conflitos.sh src/caminho
npm run check
npm run test:one -- src/lib/arquivo.test.ts
npm run test:e2e:one -- e2e/arquivo.spec.ts
```

Ambiente quebrando (`DATABASE_URL`, `R2_*`, build): [`runbooks/ambiente-agente.md`](runbooks/ambiente-agente.md).

## Onde achar o código

[`ONDE-ESTA.md`](ONDE-ESTA.md) · [`GLOSSARIO.md`](GLOSSARIO.md) · [`TESTES.md`](TESTES.md)

Prompt pronto: [`prompts/`](prompts/).
