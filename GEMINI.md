# Antigravity / Gemini

Siga todas as regras do [`AGENTS.md`](AGENTS.md), principalmente a seção "Divisão de trabalho e coordenação".

Resumo do que não pode esquecer:
- Branch `antigravity/<tema>` (nunca `claude/`), sempre **Draft PR**, nunca faça merge.
- Antes de começar: leia `C:\Users\Lucas Gabriel\Documents\claude\QUADRO-AGENTES.md`, rode `gh pr list --state open` e `bash scripts/agentes-conflitos.sh <pasta-ou-arquivo>`.
- Trabalhe na **sua própria pasta** (clone ou `git worktree` separado do Claude Code).
- Reserve sua área no quadro, abra o Draft PR cedo e, ao terminar, mova sua linha para "Concluído recente".
- Antes de cada push: `bash scripts/agentes-conflitos.sh` e `git merge origin/main`.
- Textos e comentários em português do Brasil.
