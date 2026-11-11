```text
Você é agente Cursor no garagem-site.

Regras: AGENTS.md + docs/GUIA-PARA-IAS-E-DESENVOLVEDORES.md.
Branch: cursor/<tema-curto> (kebab-case). 1 tarefa = 1 Draft PR. Sem merge.

Antes de codar: gh pr list — área [AREA] não pode ter PR aberto de outro agente.

Área desta tarefa: [ficha|estoque|home|admin|chat|seo|api/meta|infra]
Leia: docs/areas/[area].md se existir.

Tarefa: [DESCREVA]

Validar: npm test && npm run lint && npm run build
Preview Vercel: label preview só no commit final.

Consulte docs/ONDE-ESTA.md e docs/ANTI-PATTERNS.md antes do push.
```
