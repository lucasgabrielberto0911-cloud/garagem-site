A implementação desta tarefa JÁ ESTÁ no working tree de ~/wt/fix-dourado (branch reserva/fix-dourado, partindo de dff8688). Não desfaça nem recomece. A sessão anterior (1119004920-vertex, gemini-4-neon medium) caiu com HTTP 429 depois de editar os arquivos, sem commit.

O que já está feito (confira, só complete o que faltar):
- Degradês de marca só em tons de vermelho (#e8181c / #d91519 / #b31216 / #ff4448) em globals.css, tailwind.config.ts, progress-brand, shimmer e splash-bar.
- --brand-yellow / #FFC72C removidos do site público. Amarelo de aviso do admin ficou só em tailwind.admin.config.ts.
- CTA de /financiamento: "Falar sobre financiamento no WhatsApp". Textos públicos sem "simular"/"simulação". "Financiamos em até 60x" mantido. Sem simulador e sem valor de parcela.
- e2e e testes unitários já ajustados.

Agora:
1. Confira se ficou algum dourado/amarelo de marca no site público (amber, gold, yellow, #ffc0, #ffc72c, #ffd700) e se algum texto público ainda diz simular/simulação. Não mexa no gradiente oficial do Instagram nem no verde do WhatsApp. Não mexa em APIs/admin de simulação interna.
2. Rode npm test (ou suítes tocadas) + npm run lint + npm run check e tsc se couber. Corrija o que você quebrar. Não rode o e2e Playwright completo.
3. Commit claro em português, SEM incluir TAREFA.md nem TAREFA-FINISH.md.
4. Tente `git push -u origin HEAD:reserva/fix-dourado` sem force, nunca para main. Se falhar no sandbox, deixe o commit local.
5. Abra PR draft contra main (`gh pr create --draft`), corpo em português com modelo gemini-4-neon medium, o que mudou, risco, como testar, checagem de simplicidade.
6. NÃO faça merge, NÃO promova, NÃO force-push, NÃO mexa em .env/produção/Supabase, NÃO rode prisma db push.

Encerre com resumo, arquivos, testes e o link do PR se existir.
