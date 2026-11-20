Revise o commit 7c20997a17c3f6b2e6126a376dd97346f9863e58 na branch reserva/melhorias-neon, worktree ~/wt/melhorias-neon, PR #538. Você NÃO é o autor (o autor desta correção foi gemini-4-neon). Esforço medium. Modelo gemini-4-argon.

Base anterior: f3998de (melhorias visuais + WhatsApp verde). Este commit só altera testes e2e:
- e2e/caminho-busca-ficha-whatsapp.spec.ts
- e2e/home-barra-standalone.spec.ts
- e2e/links.spec.ts

Motivo: no CI (run 44447850203, e2e shard 4, desktop) o teste da ficha media o background do botão WhatsApp e recebeu rgb(31, 184, 88) (#1FB858, hover) em vez de rgb(37, 211, 102) (#25D366, cor base), porque o ponteiro do Playwright ficou em cima do botão. A correção afasta o mouse para (0,0) e usa expect.poll da cor base, no mesmo espírito de e2e/chat-ao-vivo.spec.ts.

O que conferir:
- O ajuste é mínimo e realmente evita o hover, sem enfraquecer demais a asserção (a cor base ainda precisa ser #25D366, texto branco onde já era exigido).
- Nenhum visual de produção mudou (botão continua #25D366 / hover #1FB858; assistente vermelho).
- Não quebrou a asserção de vermelho no assistente.
- Sem force, sem merge, sem .env, sem TAREFA*.md no commit, sem dados sensíveis.

Testes do autor: playwright caminho-busca-ficha-whatsapp desktop --repeat-each=2 (4 passed, 2 skipped); links desktop+mobile-390 e home-barra-standalone mobile-390 passaram; npm run check 2000/2000, lint, footguns e tsc ok. O autor notou, no desktop local, uma diferença pré-existente de 2.07px em home-barra-standalone.spec.ts:218 (animação .hero-cta) — trecho que ele não alterou. Confira se isso é irrelevante para este commit.

Escreva VEREDITO: OK ou BLOQUEANTE, com o motivo. Se BLOQUEANTE e precisar de correção local, commite na mesma branch sem force e sem incluir TAREFA*.md; o coordenador empurra. Não faça merge, não tire o draft, não mexa em produção.

Grave o parecer em ~/REVISAO-PR538-FIX.md.
