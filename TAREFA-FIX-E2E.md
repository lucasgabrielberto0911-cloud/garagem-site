Corrija a falha de e2e do PR #538 (branch reserva/melhorias-neon, worktree atual ~/wt/melhorias-neon, head f3998de). Você é o autor da correção. Esforço medium. Modelo gemini-4-neon.

## Falha (CI run 44447850203, job e2e (4), shard 4/4)
1 failed, 186 passed, 25 skipped. Não é flake.

Arquivo: e2e/caminho-busca-ficha-whatsapp.spec.ts:121
Teste: [desktop] Caminho lista -> página do carro -> botão WhatsApp › desktop: lista do estoque, abre ficha e valida botão WhatsApp oficial

```
Error: expect(received).toBe(expected) // Object.is equality
Expected: "rgb(37, 211, 102)"
Received: "rgb(31, 184, 88)"

// #25D366: verde WhatsApp (rgb 37, 211, 102)
expect(buttonBg).toBe("rgb(37, 211, 102)");
```

rgb(31, 184, 88) é exatamente o hover do WhatsAppButton solid (#1FB858). No desktop o ponteiro do Playwright ficou em cima do botão na hora de medir o background, então o teste leu a cor de hover, não a cor padrão.

## O que fazer
- Deixe o teste estável no desktop: não dependa de o ponteiro estar fora do botão. Aceite as duas cores (#25D366 padrão e #1FB858 hover), ou afaste o mouse antes de medir, ou meça de um jeito que ignore o hover. Prefira um ajuste mínimo e claro no teste.
- NÃO mude o visual do botão: continue #25D366 de fundo, texto branco, hover #1FB858, ≥56px no lg. Assistente permanece vermelho.
- Confira se a mesma asserção frágil existe em outros testes deste PR (links, home-barra-standalone, visual-pages-whatsapp) e corrija do mesmo jeito se houver.
- Não quebre o e2e que afirma vermelho no ASSISTENTE (home-barra-standalone).
- Não altere páginas, CI, produção, .env, nem TAREFA.md / este brief. Não faça force push. Não faça merge. Não mexa em depoimentos.
- Nunca mandar placa, CPF, telefone, chassi ou RENAVAM para IA; nunca mexer em .env nem em chaves.

## Testes
- Ajuste só o necessário.
- Rode o teste que falhou no projeto desktop (caminho-busca-ficha-whatsapp, o caso desktop da ficha/WhatsApp), com repeat-each=2 se possível, para confirmar que o hover não quebra de novo.
- Rode também `npm run check`, lint, footguns e tsc. Não precisa da suíte e2e inteira.

## Git
- Commit na branch atual reserva/melhorias-neon, em cima de f3998de, mensagem curta em português.
- Tente o push para origin/reserva/melhorias-neon, SEM force. Se o push falhar no sandbox (GIT_CONFIG / unable to fork), deixe o commit local — o coordenador empurra.
- Não faça commit de TAREFA.md nem deste brief.
- Não abra outro PR. Não tire o draft. Não faça merge.

Ao terminar, escreva o SHA do commit, os arquivos mudados e o resultado dos testes.
