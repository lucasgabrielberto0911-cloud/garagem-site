# Home limpa + estoque so com a lista + botoes grandes

Pedido do Lucas (18/11/2026, Brasilia). Um PR so, branch ja e `reserva/home-limpa` (esta pasta). Base: origin/main @ 1097d8b.

NAO faca merge. NAO promova pra producao. NAO use force push. Ao terminar: rode os testes, faca commit, push de `reserva/home-limpa` e abra um PR em DRAFT pra `main`. No corpo do PR, cite as fontes de tamanho de botao/alvo de toque.

## 1) /estoque e o bloco de estoque: so a lista de carros

Palavras do Lucas: "nem precisa desses filtros, temos poucos carros em estoque" e "so lista dos carros".

Remova o painel de filtros inteiro: busca, ATALHOS, marca, modelo, tipo, carroceria, preco, ano, cambio, km e "Mais filtros". Fica so a lista de carros.

- A lista ocupa a largura toda e fica bem organizada no celular e no desktop.
- Mantenha: ordenacao padrao, cards, fotos 4:3 com fundo desfocado, barra fixa do WhatsApp no celular.
- Links antigos com query de filtro (ex.: /estoque?marca=...) NAO devem quebrar: ignore os parametros e mostre a lista toda, sem erro.
- Remova o codigo morto dos filtros com cuidado (componentes, hooks, testes e e2e que so serviam aos filtros). Ajuste testes e e2e que quebrarem. Nao apague coisas ainda usadas em outro lugar (ex. chat do vendedor, se ainda filtrar por conta propria).

Arquivos uteis: `src/components/site/EstoqueBrowse.tsx`, `StockFilters.tsx`, `StockFilterControls.tsx`, `StockFilterFields.tsx`, `StockFiltersSkeleton.tsx`, `ShareStockSearch.tsx`, `src/app/(catalog)/estoque/page.tsx`, `e2e/estoque-*.spec.ts`, `src/lib/stock-filters-a11y.test.ts`.

## 2) Home limpa e simples (pagina `src/app/(catalog)/page.tsx`)

O Lucas acha o site poluido, com "um monte de botao" e "um monte de trem".

### Topo (hero)
- So tres botoes grandes: "Falar no WhatsApp", "Ver estoque" e o botao vermelho do assistente.
- Lado a lado no desktop; empilhados e de largura total no celular.
- Altura de pelo menos 56px, texto maior e legivel, largura generosa, faceis de tocar.
- Vermelho e a cor principal. Nunca dourado. Fontes Sora e Inter.
- O botao verde flutuante do WhatsApp e a barra fixa no celular CONTINUAM.

### Assistente: um unico botao vermelho de verdade
Troque o conjunto atual por UM unico botao vermelho, no padrao antigo do assistente (veja `git log` / historico de `HomeAssistantCta.tsx` e do hero; volte a esse padrao visual de botao, atualizando o tamanho).

Some da home:
- o texto/link "PERGUNTE AO ASSISTENTE" (hoje parece texto solto, sem contraste e sem forma de botao)
- o campo "Pergunte qualquer coisa"
- a caixa "Pergunte qualquer coisa sobre nossos carros"
- o balao flutuante "Dúvida sobre ... / Tirar dúvida rápida"

NAO remova a logica do assistente, so simplifique a entrada. Clicar no botao abre o assistente como antes.

O botao TEM que ser um botao de verdade, nao um link sublinhado:
- fundo vermelho cheio
- texto branco grande
- icone
- cantos arredondados
- mesma altura dos outros botoes grandes (minimo 56px)
- estados de hover e foco bem visiveis
- sem underline

### "Veiculos em destaque"
- Tire a busca "Ex.: Civic" e as fileiras FAIXA, TIPOS e MARCAS. Fica so a lista de carros, igual ao /estoque.
- Suba esse bloco na pagina: ele deve aparecer logo depois do topo, com bem menos espaco vazio antes dele.

Arquivos uteis: `HeroSearch.tsx`, `HomeAssistantCta.tsx`, `ChatNudge.tsx`, `ChatOpenButton.tsx`, `StockLanding.tsx`, `EstoqueBrowse.tsx`.

## Tamanho dos botoes (cite no PR)

Pesquise e anote estas fontes no corpo do PR (nao invente URL):
- WCAG 2.2 SC 2.5.8 Target Size (Minimum), AA: no minimo 24x24 CSS px — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- WCAG 2.2 SC 2.5.5 Target Size (Enhanced), AAA: 44x44 CSS px — https://www.w3.org/TR/WCAG22/
- Apple HIG: controles de toque com no minimo 44x44 pt — https://developer.apple.com/design/tips/
- Android / Material: alvo de toque de no minimo 48x48 dp, com ~8 dp de espaco — https://support.google.com/accessibility/android/answer/7101858
- BBC: 7-10 mm; na web, min-height/min-width de 44pt — https://www.bbc.co.uk/accessibility/forproducts/guides/mobile/target-touch-size

Usamos 56px de altura minima de proposito: fica acima do 44pt da Apple e do 48dp do Material, melhor para o publico geral (inclusive gente com dificuldade). Tambem deixe foco visivel (teclado).

## Regras
- Publico geral: simples, profissional, bem feito. Poucos elementos. Sem termos tecnicos.
- Atendimento escrito: "Atendemos Linhares, Aracruz e Grande Vitoria".
- Nunca mexa em .env, chaves, Supabase, producao. Nunca `prisma db push`.
- Sem dados reais de cliente. Nunca placa, CPF, telefone, chassi ou RENAVAM em logs, testes ou no PR.
- Nao altere depoimentos.
- Nao quebre a barra fixa do WhatsApp no celular nem o botao verde flutuante.

## Como entregar
1. Implemente tudo neste worktree (ja esta em `reserva/home-limpa`, tracking origin/main).
2. Rode lint/testes unitarios e o e2e que cobrir home e estoque. Ajuste os que quebrarem por causa da remocao dos filtros/busca.
3. Commit claro em portugues ou ingles, mensagens objetivas.
4. `git push -u origin reserva/home-limpa` (sem --force).
5. Abra PR draft para main, com descricao do que saiu, o que ficou, e as fontes de tamanho de botao.
6. No final do seu output, escreva: PR_URL, SHA, lista de arquivos e o resultado dos testes.

Se algo estiver ambiguo, escolha o caminho mais simples e limpo, sem reintroduzir filtros ou campos de busca na home/estoque.
