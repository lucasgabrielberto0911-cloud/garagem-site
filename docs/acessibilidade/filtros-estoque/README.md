# Acessibilidade dos filtros de estoque

Registro das correções de acessibilidade aplicadas em `/estoque` (desktop e sheet do celular).
Escopo: foco visível, alvos de toque e nomeação de grupos, sem alterar layout, cor ou a lógica dos filtros.

## O que mudou

- **Foco visível no campo de busca.** O `focus:outline-none` do input anulava o anel global de teclado
  (`src/app/globals.css`, regra `:focus-visible`). Removido, o campo passou a usar o anel vermelho de 2px
  com offset de 3px e ganhou altura mínima de 44px (celular) e 48px (desktop)
  (`src/components/site/StockFilters.tsx:420`).
- **Grupos nomeados.** "Atalhos", "Faixa de preço" e "Acessórios" (desktop e sheet) viraram `role="group"`
  com `aria-labelledby` apontando para o texto visível do grupo
  (`src/components/site/StockFilters.tsx:431`, `src/components/site/StockFilterFields.tsx:116`,
  `src/components/site/StockFilterControls.tsx:132`).
- **"Ver mais" de acessórios** passou a declarar `aria-expanded` e `aria-controls`
  (`src/components/site/StockFilterControls.tsx:158`).
- **Fundo do sheet do celular** virou área apenas de mouse (`aria-hidden="true"` + `tabindex="-1"`),
  mantendo "Fechar" e `Esc` como saídas (`src/components/site/StockFilters.tsx:746`).

## Antes e depois

Foco de teclado no campo de busca.

| Antes | Depois |
|---|---|
| ![Antes, 390px](antes-busca-foco-390.png) | ![Depois, 390px](depois-busca-foco-390.png) |

| Antes, 1440px | Depois, 1440px |
|---|---|
| ![Antes, 1440px](antes-busca-foco-1440.png) | ![Depois, 1440px](depois-busca-foco-1440.png) |

O resto da tela ficou idêntico: o sheet do celular e a coluna de filtros do desktop foram comparados
pixel a pixel antes/depois (0 pixel diferente). A barra de busca ganhou 2px de altura por causa da borda,
sem mexer na posição do texto.

## O que ficou de fora

O checkbox "Com vistoria da loja" continua com 16×16px. O alvo de toque real é o `<label>` de 48px que o
envolve (o clique no texto alterna o checkbox) e aumentar o desenho mudaria o visual. O Chrome ignora
`padding` em checkbox nativo com `appearance: auto`, então não dá para crescer a área do input sem
redesenhar o controle.

## Validação

```bash
npm test          # 1461 testes, incluindo src/lib/stock-filters-a11y.test.ts
npm run lint
npm run build
E2E_TEST=1 npx playwright test e2e/site-melhorias.spec.ts e2e/public-journeys.spec.ts e2e/centralizacao-site.spec.ts
```

Verificação manual em 390px e 1440px: anel de 2px `rgb(232,24,28)` com offset de 3px no campo de busca,
altura 44px/48px, `role="group"` com `aria-labelledby` resolvendo para um rótulo existente em todos os
grupos, `aria-controls` apontando para uma lista existente, `Tab` dentro do sheet começando no botão
"Fechar" (o fundo não entra na ordem) e fechamento por clique no fundo e por `Esc`.
