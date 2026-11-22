# Revisão do PR #559 — Polimento de vendas (onda 2)

- **Branch revisada:** `reserva/polimento-onda2` (`origin/main...HEAD`, commit `3b3fc1af`)
- **Escopo do diff:** 9 arquivos alterados (`+29 / -27`)
- **Checagem executada:** `npm run check` → **OK** (`2041/2041` testes unitários aprovados, `eslint .` limpo, `check-footguns: ok`, `tsc --noEmit` limpo; `build` e `e2e` não executados conforme orientação sobre conexões do Postgres local).

---

## 1. O que ficou bom e aprovado

1. **`/vendidos` (`src/app/(site)/vendidos/page.tsx`, `src/lib/vendidos-insta.test.ts`, `e2e/vendidos-galeria.spec.ts`):**
   - Subtítulo atualizado para `"Clientes que já fecharam negócio com a Garagem."`, curto, natural e sem `"novos"`.
   - Testes unitário e E2E atualizados sem enfraquecer asserções.

2. **Home (`src/app/(catalog)/page.tsx`):**
   - Containers com borda removidos e trocados por superfície sutil (`bg-ink` / `bg-white/[0.04]`): estados vazio/erro de destaques, cards de *"Por que a Garagem"*, *"Depoimentos"* (incluindo skeleton), *"Atendimento"* (com divisórias internas discretas `divide-white/10` e `border-t border-white/10`), *"Vender ou trocar seu veículo"* e *"Dúvidas frequentes"* (incluindo skeleton).
   - No bloco *"Atendimento"*, a repetição desalinhada `"Atendemos Vitória, Aracruz, Linhares."` da descrição foi removida, mantendo o título padronizado `"Atendemos Linhares, Aracruz e Grande Vitória"`.
   - Bloco final *"Ainda em dúvida"* já não possuía container com borda; botões `outline`, `input` e `select` mantiveram borda conforme permitido.

3. **Componentes compartilhados conferidos em outras páginas:**
   - **`WantedVehicleCta` (`src/components/site/WantedVehicleCta.tsx`):** usado na Home (`src/app/(catalog)/page.tsx:223`), em `/faq` (`src/app/(site)/faq/page.tsx:66`) e nas landings sem estoque `/marca/[slug]` e `/modelo/[slug]` (`src/components/site/StockLanding.tsx:69`). Nos três locais o fundo externo é `bg-asphalt`, então `bg-ink` sem `border-brand/40` preserva contraste, hierarquia e espaçamento sem piorar nenhuma página.
   - **`FaqAccordion` (`src/components/site/FaqAccordion.tsx`):** usado na Home (`src/app/(catalog)/page.tsx:471`, sobre `bg-ink/40`) e em `/faq` via `FaqExplorer` (`src/components/site/FaqExplorer.tsx:103`, sobre `bg-asphalt`). A superfície `bg-white/[0.04]` com `divide-y divide-white/10` mantém boa leitura em ambos os contextos.
   - **`Testimonials` (`src/components/site/Testimonials.tsx`):** usado exclusivamente na Home (`src/app/(catalog)/page.tsx:461`). Visual limpo em `bg-ink` sem borda externa e **nenhum conteúdo de depoimento alterado**.

4. **Regras de marca e negócio:**
   - Paleta vermelha principal preservada, fontes Sora/Inter (`font-display` / `font-body`), zero dourado/amarelo introduzido (`brand-gradient` é 100% em tons de vermelho).
   - Sem valor de parcela, sem simulador e sem termos `"simular/simulação"` (`"Financiamento em até 60x"` / `"Até 60x"` respeitados).
   - Troca de `RealStockPreview` por `VehicleGrid` em `/financiamento` traz o mesmo card de `/estoque` com foto 4:3, LQIP e botão `"Tenho interesse"`.

---

## 2. Ajustes necessários antes de aprovar

### [OBRIGATÓRIO] 1. `/financiamento`: card ímpar fica sozinho em linha cheia no celular
- **Onde:** `src/app/(site)/financiamento/page.tsx:139` e `:278` (evidência visual em `/tmp/prints-onda2/fin-estoque-390.png`).
- **Causa:** `getFeaturedVehicles(8)` retorna até 8 veículos, mas quando há quantidade ímpar disponível no estoque (1, 3, 5 ou 7), a regra global em `src/app/globals.css:498-502` (`.listing-card-grid > .listing-card-item:last-child:nth-child(odd) { grid-column: 1 / -1; }` abaixo de `1024px`) faz o último card esticar nas 2 colunas no celular — regredindo ao card largo de linha inteira que a tarefa pediu para eliminar.
- **Como corrigir (seguir o padrão já adotado em `main` por `selectSimilarVehiclesForSoldSlug` em `src/lib/sold-slug-fallback.ts:415-419` e `SoldVehicleNotFound` em `src/components/site/SoldVehicleNotFound.tsx:91-97`):**
  - **Opção A (mesmo padrão de `SoldVehicleNotFound` + `selectSimilarVehiclesForSoldSlug`):** quando `featuredWithLqip.length >= 3 && featuredWithLqip.length % 2 === 1`, cortar para quantidade par (`featuredWithLqip.slice(0, -1)` → 2, 4 ou 6 cards) **e**, para o caso de `length === 1`, envolver o `VehicleGrid` com `className="[&_.listing-card-item]:!col-span-1"` para que 1 único veículo ocupe largura de 1 coluna no celular.
  - **Opção B:** envolver o `VehicleGrid` de `/financiamento` com `className="[&_.listing-card-item]:!col-span-1"` para qualquer contagem ímpar, mantendo o último card com largura de 1 coluna no mobile.
  - Adicionar cobertura em teste (ex.: `src/lib/visual-pages-whatsapp.test.ts` ou teste unitário dedicado) garantindo que `/financiamento` não renderiza card ímpar esticado em 2 colunas no mobile.

### [IMPORTANTE] 2. `/financiamento`: caixas/cards com borda remanescentes nas seções 4 e 5
- **Onde:** `src/app/(site)/financiamento/page.tsx`
- **Detalhe:** As bordas foram removidas de `HERO_BADGES` (`L171`) e dos `<li>` de `OPTIONS` (`L231`), mas o restante da página ainda mantém containers/cards com borda que contrariam a regra do site (*"sem cards com borda"*):
  1. `L307` (`HOW_IT_WORKS`): `border border-white/15 bg-asphalt` nos 4 cards de passo a passo;
  2. `L330` e `L357` (`DOCUMENTS`): `border border-brand/35 bg-asphalt` no `<aside>` *"Checklist / Documentos necessários"* e `border border-white/10 bg-ink/80` nos 4 itens internos;
  3. `L396` (`FINANCIAMENTO_FAQ`): `border border-white/15 bg-ink ... open:border-brand/55` nos 6 `<details>` de perguntas frequentes (pode usar superfície sutil sem borda, alinhada ao `FaqAccordion`);
  4. `L415` (card lateral *"Quer consultar suas condições agora?"*): `border border-brand/40 bg-ink` (mesmo padrão de borda vermelha que foi removido do `WantedVehicleCta`).
  - *Atenção ao ajustar:* `src/lib/visual-pages-whatsapp.test.ts:133` valida `assert.match(src, /shadow-/, name)` em `financiamento/page.tsx` (e os links de navegação `L459`/`L467` são botões/links clicáveis estilo outline, que podem manter borda).

### [VERIFICAÇÃO PÓS-AJUSTE] 3. Orçamento de JS mobile no E2E de `/financiamento`
- Quando o banco local estiver com conexões livres, rodar `npm run test:e2e:one -- e2e/paginas-apoio.spec.ts` e `npm run test:e2e:one -- e2e/vendidos-galeria.spec.ts`. Em especial, `e2e/paginas-apoio.spec.ts:68` exige JS mobile `<= 220 KiB` em `/financiamento` — importante confirmar após a troca de `RealStockPreview` (Server Component puro) por `VehicleGrid` (`FavoriteButton`, `StockVehicleLink`, `VehicleCardWhatsApp`).

---

VEREDITO: AJUSTAR
