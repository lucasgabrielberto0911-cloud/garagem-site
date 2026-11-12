# HANDOFF: coordenação entre agentes (branch `claude/coordenacao-agentes`)

## Objetivo
O Lucas usa dois agentes ao mesmo tempo no garagem-site (Claude Code e Antigravity). Esta branch cria regras e uma ferramenta para um não atrapalhar o outro. Os commits de todos saem com a conta do Lucas no GitHub, então o prefixo da branch e um quadro compartilhado são a forma de saber quem faz o quê.

## O que já foi feito
- `scripts/agentes-conflitos.sh`: lista os PRs abertos que mexem nos mesmos arquivos que a sua branch, ou nos caminhos passados como argumento. Saída 0 = sem sobreposição, 2 = há sobreposição, 1 = `gh` ausente. Só lê, não altera nada. Testado: `src/components/site` acusa o PR #464; `src/components/admin/compra` não acusa nada.
- `package.json`: atalho `npm run agentes:conflitos`.
- `AGENTS.md`: linha do Antigravity na tabela de agentes, prefixo `antigravity/`, regra 5 com o uso do script, e regra 10 (pasta própria por agente, quadro compartilhado, Draft PR cedo, arquivos compartilhados um agente por vez, `git merge origin/main` antes do push).
- `GEMINI.md`: resumo para o Antigravity apontando para o `AGENTS.md`.
- `docs/areas/README.md`: referência ao script e à regra 10.
- `npm run check` passou (exit 0) nesta branch.

## O que falta
1. Abrir o Draft PR desta branch (título em português, base `main`) e deixar o Grok Bot ou o Lucas revisar. Nada foi mergeado.
2. O Lucas precisa avisar o Antigravity do quadro e do `GEMINI.md` (o quadro fica fora do repo).
3. Decidir se o script entra no CI (hoje é só ferramenta manual).
4. Confirmar se o PR #464 (`claude/qol-catalogo-a11y`) é mesmo do Antigravity.
5. Fora desta branch: o Avaliador de compra espera os números reais de custo do Lucas (preparação média por carro, transferência para a loja, taxa do despachante). Os valores de `src/lib/purchase-policy.ts` são provisórios.

## Arquivos principais
`AGENTS.md`, `GEMINI.md`, `scripts/agentes-conflitos.sh`, `package.json`, `docs/areas/README.md`.
Fora do repo (só no PC antigo): `C:\Users\Lucas Gabriel\Documents\claude\QUADRO-AGENTES.md`, o quadro de quem está em cada área. Se a VM não tiver esse arquivo, vale só `gh pr list` e o script.

## Comandos
```bash
npm ci && npx prisma generate
npm run check                                  # test + lint + footguns + tsc
bash scripts/agentes-conflitos.sh src/components/site   # quem mexe nesta pasta?
bash scripts/agentes-conflitos.sh                       # sua branch contra os PRs abertos
```
O script precisa de `gh` logado (`gh auth status`).

## Decisões
- Quadro fora do repo: vale na hora e não exige PR, mas só existe naquela máquina.
- Prefixos de branch por agente (`claude/`, `antigravity/`, `cursor/`, `codex/`); ninguém usa o prefixo de outro.
- Cada agente em sua própria pasta ou `git worktree`.
- O script só avisa; não bloqueia o push.

## Problemas conhecidos
- O quadro e a regra dependem de o Antigravity ler o `AGENTS.md`/`GEMINI.md`; não há trava automática.
- O script não enxerga trabalho que ainda não virou PR aberto; por isso a regra pede Draft PR cedo.
- No Windows, `bash` e `gh` precisam estar no PATH (Git for Windows `bin` e `C:\Program Files\GitHub CLI`); `core.autocrlf=false` para não quebrar testes sensíveis a LF.
- Produção intocável: sem deploy, sem migração, sem mexer em `.env` nem em chaves.
