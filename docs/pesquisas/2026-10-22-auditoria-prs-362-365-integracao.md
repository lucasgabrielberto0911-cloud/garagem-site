# Auditoria dos PRs #362, #363, #364 e #365 — CI e integração consolidada

Data: 22/10/2026. Branch de trabalho: `reserva/10221838cad1-2-criar-branch-consolidada-e-rod` (base `orgin/main` = `b6ec301`).
Escopo: é uma **auditoria** (substitui os itens 3 e 4 do enunciado). Nenhum arquivo do projeto foi alterado; só este relatório foi commitado e nenhum PR foi aberto.

## Resumo

- Os quatro PRs estão com **CI 100% verde** hoje (`unit`, `e2e (1..4)`, `migrations`, `check`, `Vercel`). As falhas citadas no pedido original (#364 e #365) **já foram corrigidas** pela subtarefa `10221838cad1-1` (branch `reserva/10221838cad1-1-investigar-e-corrigir-falhas-d`). Não há falha de CI em aberto para corrigir.
- A consolidação dos quatro PRs sobre a `main` atual faz **merge sem nenhum conflito**.
- Suíte completa verde no worktree consolidado: `tsc --noEmit` 0 erros, `lint` 0 avisos, `npm test` **1436/1436 aprovados**, `next build` concluído com o Postgres local.
- Achado principal de manutenção: a correção de dependências do #362 e mais dois ajustes de CI foram **cherry-pickados em duplicidade** dentro de #363, #364 e #365. Consolidar num PR único evita reaplicar o mesmo patch 4 vezes.

## Estado atual dos PRs (evidência)

Medido com `gh pr view <n> --json statusCheckRollup`. `origin/main` em `b6ec301` (#367).

| PR | Branch | Merge-base | Commits próprios | CI |
| --- | --- | --- | --- | --- |
| #362 | `reserva/10221601abce-4-seguranca-dependencias-upgrade` | `6cdd755` | `d9994f1` | ✅ todos SUCCESS |
| #363 | `reserva/10221601abce-5-regras-de-negocio-admin-bloque` | `6cdd755` | `0a86f60`, `6e40d7d` | ✅ todos SUCCESS |
| #364 | `reserva/10221601abce-6-regras-de-negocio-site-ocultar` | `b6ec301` | `42ce813`, `d45e2be`, `4bc3523`, `20484d2`(merge), `0e160d9` | ✅ todos SUCCESS |
| #365 | `reserva/10221601abce-7-identidade-visual-design-syste` | `b6ec301` | `be4cf42`, `60430c5`(merge), `2b8d816`, `50468d8`, `57248e2` | ✅ todos SUCCESS |

## Integração: merge limpo

Sequência executada localmente a partir de `origin/main`:

```
git merge origin/reserva/10221601abce-4-seguranca-dependencias-upgrade   # #362 limpo
git merge origin/reserva/10221601abce-5-regras-de-negocio-admin-bloque   # #363 limpo
git merge origin/reserva/10221601abce-6-regras-de-negocio-site-ocultar   # #364 limpo
git merge origin/reserva/10221601abce-7-identidade-visual-design-syste   # #365 limpo
```

Resultado: 4 merges, **0 conflitos**. Arquivos no consolidado vs `main`: 31 arquivos, +368/−97.

## Medições no consolidado (worktree `~/wt/deepseek`, Postgres local da VM)

- `npx tsc --noEmit` → exit **0**.
- `npm run lint` (`eslint .`) → exit **0**, sem avisos.
- `npm test` → **1436 testes, 0 falhas**, ~121 s.
- `npx prisma db push --skip-generate` → "database is already in sync" (usa `prisma.config.ts`, banco `garagem_build@localhost`).
- `npm run build` → **exit 0**, `prisma generate` + `next build` OK (rotas estáticas/SSG geradas normalmente).

Reprodução exata do build local (nunca com o `.env` de produção):

```
set -a; . ~/garagem-site/.env.build.local; set +a
npx prisma db push --skip-generate && npm run build
```

## Achados por prioridade

| Prioridade | Achado | Onde | Por que importa | Como corrigir |
| --- | --- | --- | --- | --- |
| **P1** (confirmação) | CI de #364 e #365 já está verde; não há falha pendente. | `gh pr view 364/365` (statusCheckRollup) | O objetivo "corrigir as falhas de CI" já está satisfeito pela subtarefa `cad1-1`. | Nada a fazer. Registrar e seguir para a consolidação. |
| **P2** | Correção de dependências do #362 duplicada em 4 branches. | `prisma.config.ts` idêntico nas 4 (`blob ba4a9d9`); `package.json` next `16.4.0→16.4.2` presente em #362/#363/#364/#365 | Ao mergear PR a PR, o mesmo patch de deps é reaplicado 3–4 vezes; ruído e risco de divergência do `package-lock.json`. | Consolidar num PR único (ver tarefas). |
| **P2** | Dois ajustes de CI também duplicados em #364 e #365. | `0e160d9`≡`57248e2` ("Define ambiente de teste no vercel-ignore"); `4bc3523`≡`50468d8` ("Aguarda formulário e campo de placa únicos", `e2e/lote-site.spec.ts`) | Mesma razão do item anterior: cherry-pick repetido entre PRs irmãos. | Mesma consolidação. |
| **P3** | Build local com o `node_modules` **symlinkado** para fora do worktree quebra o Turbopack. | `~/wt/*/node_modules -> ~/garagem-site/node_modules`; `next build` (Turbopack) → panic "Symlink node_modules could not be resolved" | Atinge qualquer agente que rode `next build` num worktree com symlink. No CI não acontece (usa `npm ci`, diretório real). | No worktree, usar `node_modules` real (ex.: `cp -al ~/garagem-site/node_modules .`) ou `next build --webpack`. |
| **P3** | Build local medido com Next **16.4.0** (módulos compartilhados) e não **16.4.2** do `package.json`/lock. | `./node_modules/.bin/next --version` = 16.4.0 | Diferença só de patch; o CI dos 4 PRs já validou com 16.4.2. Para fidelidade total, rodar `npm ci` antes do build. | `npm ci` no worktree antes do `npm run build`. |
| **P3** | Hex do gradiente brand (`#e8181c`, `#ff8a00`, `#ffc72c`) escrito direto em alguns pontos do CSS. | `src/app/globals.css:436`, `:1726`; `src/components/admin/VehiclePromoKitModal.tsx:86-87` | AGENTS.md pede usar tokens, não hex. É a "gradiente de detalhe" permitida, e é pré-existente (não introduzido pelo #365). | Opcional: trocar por `var(--brand-*)`. Não bloqueia a consolidação. |

Observação de marca: não há resíduo de "dourado"/"amber" como cor de UI. As ocorrências de `amber|gold` encontradas são o token de gradiente permitido (`--brand-orange`/`--brand-yellow`) e o nome de cor de pintura "Dourado" em `src/lib/vehicle-display.ts:501-502` (rótulo de cor do veículo, não design).

## Tarefas prontas (virar issue/PR)

1. **(P2) Consolidar #362–#365 numa branch única.** Partir de `origin/main` e mergear, nesta ordem: #362 → #363 → #364 → #365. Verificado: 0 conflitos. Rodar `npm test && npm run lint && npx tsc --noEmit && npm run build` antes de abrir o PR (as 5 seções padrão).
2. **(P2) Marcar #362–#365 como superados** depois do merge do consolidado, para não reaplicar os patch de deps/CI.
3. **(P3, opcional) Rodar o e2e local do `e2e/lote-site.spec.ts`** no consolidado (exige banco semeado: `npm run e2e:seed`); o CI já passou nas 4 execuções.
4. **(P3, opcional) Substituir os hex do gradiente por tokens** em `globals.css` e no promo kit.
5. **(P3, infra) Documentar no AGENTS.md** o gotcha do `node_modules` symlinkado + Turbopack em worktrees (usar `cp -al` ou `--webpack`).

## Conclusão

Os PRs #362, #363, #364 e #365 estão individualmente verdes e **integram-se sem conflito**. A suite completa (types, lint, testes e build) passa no estado consolidado. A consolidação é segura; o único ponto de atenção real é a duplicação do patch de dependências/CI entre os PRs, resolvida por fazer um PR único.
