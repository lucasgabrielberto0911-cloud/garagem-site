# TAREFA: revisão independente do revert do PR #540

Você é o revisor independente. O revert foi feito pelo coordenador com `git revert` do squash `5260fafbd3abf0e8aecd8b2f62eee6a46762573c`. Não aceite o trabalho sem conferir o diff.

Trabalho em `~/wt/revert-ficha-540`, branch `reserva/revert-ficha-540`, commit `44cb948bab6a3bc740024f304512f066217c2863`.

## Contexto

O Lucas pediu para melhorar o padrão de hoje (contraste, separações, detalhes) **sem mudar o jeito que está hoje**. O #540 tinha mudado hierarquia/estrutura da ficha no celular e foi mergeado na main, mas **não foi promovido** para suagaragem.net. Este PR só devolve a ficha ao layout de antes do #540 (o que está no ar). Um PR posterior, separado, fará o ajuste fino de contraste.

## O que revisar

Confira o diff contra `origin/main`. Este PR deve ser **apenas o revert** — nenhum polimento novo, nenhum card com borda, nenhum sticky, nenhuma mudança de fluxo.

Pontos obrigatórios:
- A árvore da ficha e dos e2e volta ao estado anterior a `5260faf` (equivalente a `93bddfe` nesses arquivos).
- Os seletores e2e de WhatsApp da ficha voltam ao que era antes do #540 (o ajuste `[data-vehicle-mobile-bar] #ficha-whatsapp` some, porque a barra/CTA voltam ao layout antigo).
- Sem valor de parcela, sem simulador, sem "Simular"/"simulação", sem "loja digital", sem dourado/amarelo.
- WhatsApp verde `#25D366` com letra branca, se o componente continuar lá.
- Sem dados reais de cliente, sem mexer em `.env`, chaves, depoimentos, Supabase ou `prisma db push`.
- Não use WebSearch, WebFetch nem Google Search.
- Não aproveite este PR para começar o ajuste de contraste — isso é outro PR.

Rode as suítes tocadas (por exemplo `src/lib/ficha-cta.test.ts` se ainda existir, e o que o revert alterar) + lint/`npm run check` se couber.

## Veredito

No final, escreva com clareza:
- **VEREDITO: OK** ou **VEREDITO: BLOQUEANTE** (e o que precisa corrigir).

Se achar bloqueante, corrija no mesmo worktree, faça commit e `git push` **sem force**, nunca para main. Não faça merge. Não promova para produção. Não inclua TAREFA.md no commit.

Encerre com o veredito, arquivos olhados, testes rodados e riscos não bloqueantes.
