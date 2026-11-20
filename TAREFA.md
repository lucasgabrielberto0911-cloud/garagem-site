# TAREFA: revisão independente do PR #543 (relançamento)

Você é o revisor independente. O autor visual foi o gemini-4-hydrogen medium (commit `2548b8f32f28447769bf2e4e62dd885fa8c95799`). Uma revisão anterior em Carbon ficou presa em `fetch failed` e foi interrompida (rc=130), mas ela deixou alterações **não commitadas** no worktree. Não revise com o Hydrogen. Não use WebSearch, WebFetch nem Google Search.

Trabalho em `~/wt/ficha-contraste`, branch `reserva/ficha-contraste`. PR draft: https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/543

## O que está no worktree

1. O commit `2548b8f`: ajuste fino de contraste e separação na ficha (layout de hoje, depois do revert #542). WhatsApp `#25D366` / texto branco; faixas `bg-ink/70`; divisórias; sem cards com borda; mesma estrutura/ordem/espaçamento.
2. Diff **não commitado** da revisão Carbon interrompida: trocar `border-white/12` por `border-white/[0.12]` em 7 arquivos de UI + testes em `src/lib/ficha-cta.test.ts`. Motivo alegado: o Tailwind do projeto é **3.4.19**, cuja escala padrão de opacidade não tem `12` (tem 10 e 20), então a classe `border-white/12` pode não ser gerada e a borda cair no Preflight opaco `#e5e7eb`. Confira se isso é verdade neste repo (tailwind.config, versão, CSS gerado). Se for correto, rode as suítes tocadas + `npm run check`/lint/`tsc`, faça **um commit claro** só dessa correção, **sem `TAREFA.md`**, e `git push` **sem force**, nunca para main. Se for incorreto ou incompleto, descarte o diff não commitado (`git checkout --` nos arquivos) e dê o veredito só sobre o `2548b8f`.

## Pontos obrigatórios do visual

Pedido do Lucas: melhorar o padrão que está hoje (mais contraste, melhores separações e detalhes), **sem mudar o jeito que está hoje**.

- Mesma estrutura, ordem e espaçamento. Sem sticky novo no desktop, sem reabrir o #515.
- Só contraste e separação: divisória sutil ou faixas no tema escuro. **Sem cards com borda/sombra. Sem vazio extra.**
- WhatsApp verde `#25D366` com letra **branca**. Assistente, se aparecer, vermelho.
- Sem "Simular"/"simulação", sem parcela, sem "loja digital", sem dourado/amarelo. Fontes Sora/Inter. Vermelho como cor principal.
- Fotos 4:3 com fundo desfocado intactas. Barra fixa no celular não cobre conteúdo.
- Sem dados reais de cliente, sem mexer em `.env`, chaves, depoimentos, Supabase ou `prisma db push`.

O CI do SHA `2548b8f` já ficou verde depois de relançar o e2e (4) (run 44772603895, attempt 2, SUCCESS). A falha anterior era flake de alinhamento do hero da **home** (`home-barra-standalone.spec.ts`), fora deste PR — **não altere esse teste** nesta revisão.

## Veredito

No final, escreva com clareza:
- **VEREDITO: OK** ou **VEREDITO: BLOQUEANTE** (e o que precisa corrigir).

Não faça merge. Não promova. Não force-push. Nunca para main. Não inclua TAREFA.md no commit.

Encerre com o veredito, se houve commit novo, arquivos olhados, testes rodados e riscos não bloqueantes.
