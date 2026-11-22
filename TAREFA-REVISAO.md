# REVISÃO do PR #546 — rodízio de 2 dias dos destaques

Você é o REVISOR, não o autor. Modelo: gemini-4-hydrogen medium. O autor foi gemini-4-carbon medium.

PR: https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/546
Branch: reserva/home-rodizio
Commit: 48a7da5
Base original: da77e99 (a main agora também tem o #545 / `4b15be04`; o diff deste PR não deve brigar com o visual da home).

## 0. NÃO use WebSearch, WebFetch nem Google Search

Revise `git diff da77e99..HEAD` (sem TAREFA.md) e o código de cache/admin.

## Critérios obrigatórios

- Semente determinística: `period = floor(dias_desde_epoch / 2)` em **America/Sao_Paulo**. Mesmo período → mesmo conjunto (SSR/ISR). Sem `Math.random()`.
- Até **4** pins (`featured` existente), vêm primeiro. 5º recusado na UI e na API/actions. Grade da home continua até **8**.
- Vendidos/indisponíveis de fora; **consignados entram**.
- Chave de cache inclui o `period`.
- Testes unitários da semente, virada de 2 dias, teto de 4 e exclusões.
- Sem `prisma db push`. Se houver migration, só o arquivo (não aplicar). Se não houver, confirme que o schema atual basta.
- Sem alterar texto de depoimentos, sem Simular/parcela/loja digital/dourado, sem force-push, sem merge, sem promoção.
- Não "consertе" o flake da home (~218).

Se houver bloqueante neste escopo: correção mínima, `npm run check`, commit em português (sem TAREFA.md), push SEM force (se falhar, deixe local).

## Saída

**VEREDITO: OK** ou **VEREDITO: BLOQUEANTE**. Depois: resumo, arquivos, testes, commit novo se houver, se há migration pendente de ok do Lucas, riscos. NÃO faça merge. NÃO promova. NÃO force-push.
