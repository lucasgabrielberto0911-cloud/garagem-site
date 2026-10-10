# Assistente Garagem: ajustes das duas listas do Lucas

## Resumo para o PR

O chat distingue aceleração de orçamento, preserva o assunto técnico em “e o City?” e compara todos os carros disponíveis nos rankings. Após uma seleção de HB20, responde sobre esse grupo e acrescenta uma linha sobre o destaque do estoque inteiro. O Lancer 2.0 de 160 cv aparece na regressão mesmo quando fica depois dos primeiros 16 anúncios.

A garantia usa `STORE_WARRANTY`, incluindo checagem antes do anúncio, cobertura comercial de três meses para motor e câmbio e exclusões. Perguntas de opcionais respondem o item solicitado; fragmentos importados não entram na lista. Prompt e guardas separam conhecimento do modelo de fatos da unidade, evitam equipamentos sem cadastro ou evidência exata de série e impedem críticas espontâneas. A pergunta direta sobre consumo do Lancer recebe números de referência, contexto e encaminhamento ao vendedor.

Pontos positivos e comparações usam conhecimento do modelo e perfis de compra. Pesquisa confirmada entra no contexto da resposta, junto ao bloco especialista; fontes ficam em uma linha recolhida. A API deixa de transmitir HTML de sugestões e a UI não renderiza painel separado ou iframe. Cards continuam presentes nos pedidos de estoque.

Grounding fixa Gemini 3.5 Flash-Lite primeiro e 2.5 como reserva para endpoint rejeitado, com quatro segundos por tentativa e raciocínio mínimo. A cadeia existente de chat Gemini → DeepSeek permanece. `console.info` passa pelo compilador; logs redundantes de modelo foram removidos, mantendo a telemetria sem texto do visitante.

## Evidências

- `src/lib/chat-search-filters.ts:9`: remove aceleração antes de interpretar preço mínimo/máximo.
- `src/lib/chat-expert.ts:283`: continuidade do assunto técnico sem carregar filtros.
- `src/lib/chat-expert.ts:323`: ranking com o estoque completo de carros; motos ficam fora da comparação de carros.
- `src/lib/chat-warranty.ts:7`: texto derivado da política oficial, sem duplicar a cobertura.
- `src/lib/chat-stock.ts:753`: normalização dos acessórios e resposta específica para multimídia, teto solar e segurança.
- `src/lib/chat-turn.ts:706`: pesquisa com identidade pública exata e incorporação no prompt; resultado protegido antes de exibir no streaming.
- `src/components/site/SiteChat.tsx:384`: fontes recolhidas, sem repetir parágrafos nem sugestões.
- `src/lib/chat-gemini.ts:360`: prioridade 3.5, reserva 2.5 e limite de latência do grounding.
- `next.config.mjs:6`: preservação de `console.info`; `console.log` continua removido.
- `src/lib/chat-lucas-regression.test.ts`: 12 regressões locais, incluindo a conversa exata reportada e a jornada de seis turnos.
- `e2e/chat-mobile-polish.spec.ts`: cenário novo de fontes recolhidas, sem iframe e sem repetição da evidência na mensagem.

Os 10,9 s dos dois Civic foram mantidos como referência aproximada das fichas [LXR 2.0 automático 2015](https://autopapo.com.br/honda/civic-lxr-20-ivtec-flex-aut-2015/) e [EXL 2.0 CVT 2020](https://autopapo.com.br/honda/civic-exl-20-cvt-2020/). Não representam medição da unidade nem confirmação de desempenho pelo fabricante. Testes de pista variam: a [Revista Carro mediu 9,9 s no LXR 2015](https://revistacarro.com.br/teste-honda-civic-lxr/) e a [Webmotors mediu 10,9 s no EXL](https://www.webmotors.com.br/wm1/testes/honda-civic-exl-teste). A resposta reúne os tempos semelhantes e distingue automático de cinco marchas e CVT.

## Validação

- `env -u JEV_API_KEY -u OPENROUTER_API_KEY npm test`: executado, mas o CLI `tsx` não abre seu pipe IPC (`listen EPERM`).
- Alternativa com os mesmos 130 arquivos: `env -u JEV_API_KEY -u OPENROUTER_API_KEY node --import tsx src/lib/<arquivo>.test.ts`, em processos separados. Resultado: **835 passaram; uma falha** em `gallery-preview`, por `listen EPERM` em `127.0.0.1`. Nenhuma falha de chat. Após o último ajuste da guarda de ranking, os cinco arquivos afetados foram repetidos e passaram.
- `npm run lint`: passou, com cinco avisos preexistentes em `catalog-feed-http.ts`.
- `npx tsc --noEmit`: passou.
- `npm run build`: executado; Turbopack bloqueado pelo sandbox ao abrir porta/processo (`Operation not permitted`).
- `npm run build -- --webpack`: tentativa alternativa bloqueada ao obter `TypeScript --showConfig`.
- `npm run test:e2e`: executado; configuração recusou iniciar sem `E2E_TEST=1` e banco local dedicado. Nenhum banco foi preparado ou alterado.
- `git diff --check`: passou.

## Decisões, limites e riscos

- O estoque usado em testes é uma fixture local; não houve consulta ou escrita em banco, alteração na Vercel, push, PR ou merge. As mudanças anteriores não commitadas foram revisadas e aproveitadas. O resultado permanece no working tree para o coordenador commitar.
- A pesquisa paga é reservada a lacunas, segurança ou pedidos explícitos que não tenham sido atendidos pela resposta local. Dados locais cobertos evitam uma chamada desnecessária.
- A guarda de equipamento é conservadora: diante de dúvida pede confirmação, em vez de apresentar um item de outra unidade como certeza.
- O texto gerado é acumulado antes de enviar ao visitante, para não exibir afirmações incorretas antes de aplicar a guarda. Isso aumenta o tempo até aparecer texto; a UI mantém seu estado de carregamento.
- As fichas técnicas existentes continuam sendo referências editoriais. Não houve auditoria documental de todas as versões. Modelos sem ficha não permitem garantir um ranking absoluto; o chat informa o limite dos dados.
- Não houve chamada real aos provedores nem medição Lighthouse/INP/LCP/CLS no preview. A qualidade final do texto dos modelos e a latência precisam ser verificadas em 390 px.

## Prioridades e tarefas para o coordenador

| Prioridade | Impacto × esforço | Tarefa pronta para revisão/CI |
| --- | --- | --- |
| P0 | Alto × baixo | Revisar o diff e commitar na branch existente; rodar test, lint, tsc e build em ambiente sem a restrição de portas. |
| P0 | Alto × médio | No preview, executar a jornada de seis turnos em 390 px e a sequência Civic → Kicks → Corolla → City. Conferir cards, foco, fontes recolhidas e fechamento no WhatsApp. |
| P1 | Alto × baixo | Conferir logs `[chat] turn` e `[jev] ok`, sem chave nem mensagem de visitante; verificar reserva após 404 e a latência dos provedores reais. |
| P1 | Médio × médio | Rodar e2e com banco local dedicado e comparar as métricas móveis antes/depois no preview. |
