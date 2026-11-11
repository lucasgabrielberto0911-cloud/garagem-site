# Como contribuir — Garagem (garagem-site)

Obrigado por contribuir. Este repositório é mantido por humanos e **vários agentes de IA** em paralelo.

## Leitura obrigatória

1. [`AGENTS.md`](AGENTS.md) — regras, produção, cache, marca, PRs.
2. [`docs/GUIA-PARA-IAS-E-DESENVOLVEDORES.md`](docs/GUIA-PARA-IAS-E-DESENVOLVEDORES.md) — mapa do código.
3. [`docs/README.md`](docs/README.md) — índice de toda a documentação.

## Fluxo de código

```bash
npm ci && npx prisma generate
npm run check          # test + lint + footguns + tsc (igual ao job unit do CI)
npm run check:build    # check + build (antes do push com mudança de tela)
```

Teste unitário isolado: `npm run test:one -- src/lib/nome.test.ts`  
E2E isolado: `npm run test:e2e:one -- e2e/nome.spec.ts`

Node: use `.nvmrc` (24, alinhado ao CI).

E2E (quando mexer em UI): ver [`docs/E2E-PARA-IAS.md`](docs/E2E-PARA-IAS.md) e [`e2e/README.md`](e2e/README.md).

## Branches e PRs

| Quem | Branch | Merge |
| --- | --- | --- |
| Cursor | `cursor/<tema>` | **Não** — Draft PR |
| Claude | `claude/<tema>` | **Não** — Draft PR |
| Codex | `codex/<tema>` | Só arquivos em `docs/pesquisas/` |
| Humanos | convenção acima ou feature branch | Revisão + CI |

Antes de começar: `gh pr list` — não duplicar área com PR aberto.

Preview Vercel: label `preview` ou `[preview]` **no commit final** (ver `AGENTS.md`).

## Linguagem

Código (comentários úteis), PRs e textos do site: **português do Brasil**.

## Segurança

- Sem `.env` no git.
- Sem comandos de banco/seed/scripts contra **produção**.
- Sem download de fotos de `suagaragem.net` ou Storage de produção.

Dúvidas de processo: coordenador (Grok Bot) / Lucas.
