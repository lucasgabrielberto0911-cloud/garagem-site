Você é o revisor independente do PR #539 (https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/539), branch reserva/fix-dourado, HEAD 9d00db082750503afb0228d253ba1a772968275a, base main dff8688. O autor foi gemini-4-neon medium; você é gemini-4-argon medium. NÃO use Neon. Não revise como se tivesse escrito o código.

Escopo do PR:
1. Tirar dourado/amarelo de marca (faixa do topo visível em /links, filete do wordmark no rodapé, --brand-gradient, shimmer, splash, tokens #ffc72c / brand-yellow). Deve ficar vermelho puro ou degradê só entre tons de vermelho. Instagram oficial e verde do WhatsApp não mudam.
2. CTA de /financiamento: "Falar sobre financiamento no WhatsApp". Sem "simular"/"simulação" nos textos públicos. Sem simulador e sem valor de parcela. "Financiamos em até 60x" pode ficar.

Confira o diff contra main, busque residual de dourado/amarelo de marca no site público e residual de "simular" em copy pública, e leia os testes alterados.

Grave o parecer em ~/REVISAO-PR539.md começando com uma linha `VEREDITO: OK` ou `VEREDITO: BLOQUEANTE`. Justifique.

- Se OK: não edite código.
- Se BLOQUEANTE: corrija o mínimo, rode npm test / lint / check das suítes tocadas, commit em português (sem TAREFA*.md), tente push sem force para reserva/fix-dourado. Se o push falhar no sandbox, deixe o commit local.
- NÃO faça merge, NÃO force-push, NÃO promova, NÃO mexa em .env/produção/Supabase, NÃO rode prisma db push.

Encerre com o veredito e o SHA do HEAD.
