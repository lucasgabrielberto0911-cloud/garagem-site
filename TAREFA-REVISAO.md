# REVISÃO do PR #544 — WhatsApp texto/ícone escuros no verde

Você é o REVISOR, não o autor. Modelo: gemini-4-carbon medium. O autor foi gemini-4-hydrogen medium (não reveja o próprio trabalho; este é outro modelo).

PR: https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/544
Branch: reserva/whatsapp-escuro
Commit: e58c24e (WhatsApp: texto e ícones escuros nos botões verdes do site)
Base: main @ 6e271fd

## 0. NÃO use WebSearch, WebFetch nem Google Search

Revise o diff local (`git diff 6e271fd..HEAD`, sem TAREFA.md) e o código relacionado.

## Pedido do Lucas

"só não gostei do botão do whatssapp ter letras brancas."

Critérios obrigatórios:
- Fundo dos botões verdes de WhatsApp permanece `#25D366`.
- Texto e ícone escuros (`text-asphalt` / `#0D0D0F` / `#0b0b0b` / `ink`, tom quase preto). Não pode ficar branco nesses botões verdes.
- Vale no site inteiro: barra inferior da ficha, CTA da ficha, header/topo, barra fixa no celular, `/links`, home e demais páginas públicas que usem o botão verde.
- Layout, tamanho, forma, rótulo e espaçamento NÃO mudam.
- Botão do assistente continua vermelho com texto branco.
- Testes que afirmavam `text-white` / branco nesses botões verdes precisam ter sido atualizados.
- O flake de alinhamento da home (`e2e/home-barra-standalone.spec.ts` ~218–219, limite < 2px) NÃO deve ter sido “consertado” neste PR. Só a asserção de cor do WhatsApp pode ter mudado nesse arquivo.
- Sem `TAREFA.md` no commit. Sem `.env`, chaves, Supabase, `prisma db push`, depoimentos, simulador, “loja digital”, dourado.

Se encontrar um botão verde de WhatsApp ainda com texto/ícone branco, ou um teste quebrado por isso: faça a correção mínima, rode `npm run check` (ou as suítes tocadas), commite em português (sem TAREFA.md), e tente `git push` SEM force (se o push falhar, deixe o commit local). Não altere o layout.

## Saída

Comece a revisão na hora. No final, imprima claramente:

**VEREDITO: OK** ou **VEREDITO: BLOQUEANTE**

Depois: resumo, arquivos inspecionados, testes rodados, se houve commit novo, e riscos não bloqueantes. NÃO faça merge. NÃO promova. NÃO force-push.
