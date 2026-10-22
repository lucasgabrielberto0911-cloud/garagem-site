# Auditoria do site principal (catálogo, ficha, chat, SEO, a11y, UX)

Data: 22/10/2026. Tarefa: `10221601abce-2`. Base analisada: `6cdd75531d64d3034f80740835308f32e6d99ead` (`origin/main`).

## Resumo

Esta auditoria cobriu as rotas e componentes públicos do site da **Garagem** (`src/app/(catalog)`, `src/app/(vehicle)`, `src/app/(site)`, `src/components/site`, `src/app/api/chat` e `src/lib`), com foco em:
1. Regras de negócio essenciais (preço estritamente oculto em veículos vendidos; cidade restrita ao painel admin; marca Garagem sem menções novas de "Sua Garagem").
2. Identidade visual e design tokens (fontes Sora e Inter, proibição de Barlow Condensed, paleta asphalt/cream/brand, proibição de cores douradas/amarelas).
3. Chat e assistente com IA (timeout de 45 s, cadeia de fallback Gemini 3.5 Flash-Lite → 2.5 Flash-Lite → DeepSeek via OpenRouter, e regra de não exibir moto sem solicitação expressa).
4. SEO e performance (JSON-LD válido, metadados canônicos, sitemap, cache ISR com revalidate = 3600, otimização de imagens sem custo excessivo de Vercel Image Optimization).
5. Acessibilidade e eventos de conversão Meta (Pixel `AddToCart` e `Lead` com `content_type=vehicle` e `content_ids` alinhados ao catálogo de anúncios da Meta).

Foram mapeados **9 achados: nenhum crítico, 1 alto, 3 médios e 5 baixos**.
O achado de maior atenção é que o utilitário de fatos do card (`publicCardFacts`) não recebe o status do veículo e pode gerar rótulo de preço caso receba um veículo com `status: "vendido"` (por exemplo, na visualização de favoritos em cache offline ou na tela de comparação). No SEO, identificou-se também duplicação de UF (`"Aracruz, ES, ES"`) no schema `LocalBusiness` da Home.

O site apresenta excelente maturidade técnica: 0 erros de linting, tipagem TypeScript estrita sem erros (`tsc --noEmit`), 144 testes unitários de catálogo/chat passando em ~4,8 segundos, e conformidade rigorosa com fontes (Sora/Inter sem Barlow) e botões de conversão com dimensões adequadas para toque (WCAG).

---

## Método, cobertura e limites

- **Varredura estática de código e conformidade**:
  - Tipografia: rastreamento de ocorrências de Barlow Condensed, `@font-face`, fontes externas e classes de utilitário (`font-display`, `font-body`, `font-sans`).
  - Cores e tokens: varredura por hexadecimais soltos, classes Tailwind da família `amber`/`yellow`/`gold`, e uso dos tokens `asphalt`, `cream`, `ink`, `brand`, `muted`.
  - Regras de negócio: rastreamento de `status === "vendido"` em cards, fichas, JSON-LD, chat, rotas de WhatsApp e rotas de favoritos; rastreamento de exibição de `city`/`locationCity`.
  - Chat: inspeção do timeout (`maxDuration = 45`), cadeia de modelos (`chat-gemini.ts`, `chat-openrouter.ts`), prompt do sistema e filtros de categoria (`carro` vs `moto`).
  - SEO e Cache: validação de `revalidate` em todas as rotas públicas, canonical URLs, robots (`noindex, follow` para vendidos), tags de invalidação `unstable_cache`.
- **Validação automatizada e testes**:
  - `npx tsc --noEmit`: 100% verde (sem erros de tipo).
  - `npm run lint`: 100% verde (sem violações ESLint).
  - Baterias de testes do catálogo e chat: `chat-stock.test.ts`, `chat-gemini.test.ts`, `chat-sold.test.ts`, `chat-lead.test.ts`, `chat-search.test.ts`, `public-card-facts.test.ts`, `public-stock.test.ts`, `stock-query.test.ts`, `vehicle-display.test.ts`, `seo.test.ts`, `seo-local.test.ts` (144 testes executados, 144 aprovados).
  - `next build`: build de produção executado contra banco PostgreSQL local da VM (`garagem_build`), gerando SSG e rotas dinâmicas com sucesso.
- **Auditoria visual com Chromium Headless (Playwright)**:
  - Navegação em `localhost:3000` em resoluções mobile (390x844 e 320x568) e desktop (1440x900).
  - Captura e inspeção computada de estilos de fontes (`getComputedStyle`), dimensões de chips, comportamento da gaveta de filtros no mobile, renderização de ficha disponível vs vendida e abertura do assistente.

---

## Matriz de rotas e componentes públicos

| Rota / Componente | Papel | Cache / ISR | Tokens / Fontes | Conversão / Meta |
| --- | --- | --- | --- | --- |
| `/` (`Home`) | Vitrine principal, busca rápida, destaques e depoimentos | `revalidate = 3600` | Sora nos títulos, Inter no corpo. Sem Barlow. | `SiteLeadHit` em atalhos; Schema `AutoDealer` + `LocalBusiness` |
| `/estoque` | Catálogo completo com filtros facetados e atalhos | `revalidate = 3600` | Chips pequenos (12px), fundo sutil `rgba(255,255,255,0.055)`. | WhatsApp nos cards (`VehicleCardWhatsApp`) |
| `/estoque/[id]` | Ficha detalhada do seminovo | `revalidate = 3600` (slug canônico) | Sora / Inter; fotos com WebP sem next/image. | `VehicleLeadHit` com `trackAddToCart` e `trackLead` |
| `/marca/[slug]`, `/modelo/[slug]` | Landing pages de SEO do estoque | `revalidate = 3600` | Padrão unificado do catálogo. | Mesma grade de cards e conversão da vitrine |
| `/seminovos`, `/seminovos/[cidade]` | SEO regional (Linhares, Aracruz, Vitória, etc.) | `revalidate = 3600` | Cidade regional exibida; sem cidade do veículo individual. | `SiteLeadHit` regional |
| `/favoritos` | Lista de veículos favoritados no navegador | Cliente / API `/api/veiculos` | Compara até 3 veículos lado a lado. | WhatsApp com tracking de favoritos |
| `/vender`, `/pedido` | Captação de leads para venda/troca e encomenda | `3600` (`vender`), `600` (`pedido`) | Formulários com foco acessível e feedback visual. | Disparo de lead para o admin |
| `/api/chat` | Assistente virtual inteligente integrado ao estoque | `runtime = nodejs`, `maxDuration = 45` | Fallback Gemini 3.5 → 2.5 → DeepSeek. | Resposta de lead e transição para WhatsApp |
| `/sitemap.xml` | Mapa de URLs canônicas indexáveis | `revalidate = 300` | Filtra apenas veículos disponíveis (`status: "disponivel"`). | URLs canônicas completas com imagens |

---

## Achados da Auditoria

### Severidade Alta

#### 1. `publicCardFacts` não recebe `status` e não bloqueia exibição de preço em veículos vendidos
- **Arquivos-alvo**: `src/lib/public-card-facts.ts:17-50`, `src/components/site/VehicleCard.tsx:45,121`, `src/components/site/FavoritesComparison.tsx:28`.
- **Severidade**: Alta (Regra de Negócio Crítica).
- **Evidência**:
  A regra de negócio do projeto estabelece:
  > *"Carro vendido não mostra preço em lugar nenhum: ficha, card, JSON-LD, mensagem de WhatsApp e assistente."*
  
  No arquivo `src/lib/public-card-facts.ts`:
  ```ts
  export type PublicCardFactsInput = {
    brand?: string | null;
    model?: string | null;
    version?: string | null;
    yearModel?: number | null;
    km?: number | null;
    transmission?: string | null;
    locationCity?: string | null;
    price?: number | null;
  };
  ```
  A função `publicCardFacts` calcula o preço apenas com base no número:
  ```ts
  const price = finiteNumber(input.price);
  const priceLabel = price != null && price > 0 ? formatCurrencyBRL(price) : "";
  ```
  No componente `VehicleCard.tsx`, o status `vendido` possui badge configurado (`STATUS_BADGE.vendido`), mas a exibição do preço na linha 121 é controlada unicamente por:
  ```tsx
  <div className="listing-card-price-row">
    {card.priceLabel ? <p className="listing-card-price font-display text-brand-light">{card.priceLabel}</p> : null}
  </div>
  ```
  Similarmente, em `src/components/site/FavoritesComparison.tsx`:
  ```tsx
  { label: "Preço", metric: "price", value: v => publicCardFacts(v).priceLabel.replace(/[\u00a0\u202f]/g, " ") || "Consulte" }
  ```
  Se um veículo for favoritado e posteriormente vendido, caso o usuário abra os favoritos offline ou compare veículos que já foram vendidos, o preço continuará sendo gerado no card e na tabela comparativa.
- **Impacto**: Risco de exibir preço de veículo já vendido em listas de favoritos, históricos salvos ou componentes que reutilizem `VehicleCard` e `publicCardFacts`.
- **Solução recomendada**:
  1. Incluir `status?: string | null` em `PublicCardFactsInput`.
  2. Em `publicCardFacts`, caso `input.status === "vendido"`, forçar `priceLabel = ""`.
  3. Adicionar teste unitário em `src/lib/public-card-facts.test.ts` cobrindo veículo com `status: "vendido"`.

---

### Severidade Média

#### 2. Duplicação de UF no schema `LocalBusiness` da Home (`"Aracruz, ES, ES"`)
- **Arquivo-alvo**: `src/lib/seo.ts:234`.
- **Severidade**: Média (SEO & Dados Estruturados).
- **Evidência**:
  Em `src/lib/seo.ts:234`, ao gerar os reviews para o JSON-LD `LocalBusiness`:
  ```ts
  ...(review.city ? { address: { "@type": "Place", name: `${review.city}, ES` } } : {}),
  ```
  Os depoimentos no banco (`Testimonial`) e as sementes do seed já contêm cidades gravadas com o sufixo estadual (ex.: `"Aracruz, ES"`, `"Linhares, ES"`, `"Serra, ES"`).
  Na auditoria com Chromium, a extração dos blocos JSON-LD da Home revelou a string resultante:
  ```json
  "author": {
    "@type": "Person",
    "name": "Camila R.",
    "address": {
      "@type": "Place",
      "name": "Aracruz, ES, ES"
    }
  }
  ```
- **Impacto**: Inconsistência nos dados estruturados consumidos pelo Google Rich Results e validadores de Schema.org.
- **Solução recomendada**:
  Normalizar a string antes de concatenar, garantindo que o sufixo `ES` não seja duplicado:
  ```ts
  const cleanCity = review.city.replace(/[,/]\s*ES$/i, "").trim();
  const addressName = cleanCity ? `${cleanCity}, ES` : "Espírito Santo";
  ```

#### 3. Uso de classes `amber-*` (dourado/amarelo) no Chat do site
- **Arquivo-alvo**: `src/components/site/SiteChat.tsx:1199, 1218, 1392`.
- **Severidade**: Média (Identidade Visual / Marca).
- **Evidência**:
  A regra de identidade visual da Garagem proíbe dourado:
  > *"Cores da loja: branco e vermelho. Nunca dourado."*
  
  Em `src/components/site/SiteChat.tsx`:
  - Linha 1199: `vehicleContext.sold ? "bg-amber-400" : "bg-brand"`
  - Linha 1218: `bg-amber-400/[0.12] text-amber-200 ring-1 ring-inset ring-amber-400/30 hover:bg-amber-400/20`
  - Linha 1392: `border border-amber-300/15 bg-amber-300/[0.05]`
- **Impacto**: O alerta de falha e o chip de veículo vendido no chat exibem tonalidades amareladas/douradas, destoando da paleta estrita de branco, vermelho (`brand`), preto (`asphalt`/`ink`) e off-white (`cream`).
- **Solução recomendada**:
  Substituir as classes `amber-*` por tokens neutros (`cream/70`, `white/10`, `white/20`) ou usar o token oficial `brand-orange` (`#FF8A00`) caso seja necessária diferenciação sem cair em dourado/amarelo.

#### 4. Discrepância de TTL de Cache ISR em `/pedido` (`revalidate = 600`)
- **Arquivo-alvo**: `src/app/(site)/pedido/page.tsx:13`.
- **Severidade**: Média (Economia de Deploys e Invalidações na Vercel).
- **Evidência**:
  Na linha 13 de `src/app/(site)/pedido/page.tsx`:
  ```ts
  export const revalidate = 600;
  ```
  Todas as demais páginas institucionais e de catálogo (`/`, `/estoque`, `/contato`, `/vender`, `/faq`, `/seminovos`, `/modelos`, `/sobre`, etc.) utilizam rigorosamente:
  ```ts
  export const revalidate = 3600;
  ```
  A página `/pedido` é uma página institucional com formulário estático para o usuário solicitar um carro que não encontrou no estoque. Não há necessidade de regeneração a cada 10 minutos (600 s).
- **Impacto**: Regenerações desnecessárias na Vercel Hobby quando há acessos à página `/pedido`.
- **Solução recomendada**:
  Alinhar para `export const revalidate = 3600;`.

---

### Severidade Baixa

#### 5. Espalhamento de hexadecimais de hover (`#c91418`) e acento (`#ed1018`)
- **Arquivos-alvo**:
  - `src/components/site/ui.tsx:175`
  - `src/components/site/VehicleMobileBar.tsx:247`
  - `src/components/site/HeroSearch.tsx:55`
  - `src/components/site/SellForm.tsx:350`
  - `src/components/site/SiteHeader.tsx:174`
  - `src/components/site/ChatOpenButton.tsx:30`
  - `src/components/site/HomeAssistantCta.tsx:73`
  - `src/components/site/InstallPrompt.tsx:196`
  - `src/components/site/FavoritesComparison.tsx:51`
  - `src/components/site/SellPhotoUpload.tsx:69`
- **Severidade**: Baixa (Consistência de Design Tokens).
- **Evidência**:
  Oito componentes repetem a classe `hover:bg-[#c91418]` em botões de ação e dois componentes utilizam `accent-[#ed1018]`, em vez de empregar tokens Tailwind centralizados.
- **Solução recomendada**:
  Incluir no `tailwind.config.ts` o token `brand-dark` ou utilizar utilitários de opacidade/brilho (`hover:brightness-95` ou `hover:bg-brand/90`) e `accent-brand`.

#### 6. Uso isolado de `font-sans` em vez de `font-body` em nota de comparação
- **Arquivo-alvo**: `src/components/site/FavoritesComparison.tsx:114`.
- **Severidade**: Baixa (Tipografia).
- **Evidência**:
  ```tsx
  <span className="mt-1 block font-sans text-[10px] font-normal leading-relaxed text-muted sm:text-xs">
  ```
  O restante do site utiliza `font-display` (Sora) ou `font-body` (Inter). O uso de `font-sans` utiliza a fonte padrão do Tailwind caso a herança do body seja sobrescrita.
- **Solução recomendada**:
  Ajustar para `font-body`.

#### 7. CSS residual de cidade nos cards em `globals.css`
- **Arquivo-alvo**: `src/app/globals.css:597-603, 645`.
- **Severidade**: Baixa (Higiene de Código).
- **Evidência**:
  Os seletores `.listing-card-city` e `.listing-card-city dd` permanecem em `globals.css`, embora o campo de cidade tenha sido completamente removido dos cards públicos no PR #219 ("A cidade do veículo aparece só no admin").
- **Solução recomendada**:
  Remover os seletores mortos de `src/app/globals.css`.

#### 8. Rota `/api/chat` sem `dynamic = "force-dynamic"` explícito
- **Arquivo-alvo**: `src/app/api/chat/route.ts:1-12`.
- **Severidade**: Baixa (Resiliência de Route Handlers).
- **Evidência**:
  A rota exporta `runtime = "nodejs"` e `maxDuration = 45`, mas não declara `dynamic = "force-dynamic"`. O método GET serve o health check e pode ser pré-renderizado como estático pelo compilador Next.js.
- **Solução recomendada**:
  Adicionar `export const dynamic = "force-dynamic";`.

#### 9. Recomendação de segurança Next.js emitida no build
- **Severidade**: Baixa / Notificação de Manutenção.
- **Evidência**:
  Durante a execução do comando `npm run build`, o CLI do Next.js emitiu o aviso:
  `Error [SecurityFatalError]: Your version of Next.js is affected by a known security vulnerability. We strongly recommend you upgrade Next.js.`
  O build concluiu na tentativa de retry, mas requer atenção futura de atualização de dependências via PR dedicado.

---

## Verificações Realizadas

### 1. Tipografia e Cores
- **Fontes**: A inspeção via Chromium confirmou que títulos (`h1`, `h2`, botões) renderizam computadamente com `Sora, "Sora Fallback", sans-serif`, e o corpo do texto renderiza com `Inter, "Inter Fallback", sans-serif`.
- **Barlow**: Nenhuma ocorrência de Barlow no código do site público (`src/`).
- **Marca**: Nenhuma nova ocorrência visível de "Sua Garagem"; o assistente, cabeçalho e rodapé utilizam rigorosamente "Garagem".

### 2. Veículo Vendido
- Testado com o veículo Volkswagen Fox 1.6 2014 (`cmvjxlz4d0006vj71ij1glj75`):
  - **Título**: `"Volkswagen Fox 1.6 2014 (vendido) | seminovo ES | Garagem"`.
  - **Robots**: `noindex, follow`.
  - **Preço no corpo da página**: Estritamente ausente (expressões de preço como `R$ 38.900` foram removidas em favor do aviso *"Este veículo já foi vendido"*).
  - **Oferta no JSON-LD**: Contém `"availability": "https://schema.org/OutOfStock"`, e os campos `price` e `priceCurrency` foram completamente omitidos.
  - **WhatsApp CTA**: Transforma-se em botão *"Pedir parecido no WhatsApp"*, sem preço no corpo da mensagem.

### 3. Chips nos Cards do Estoque
- **Dimensões e hierarquia**: Os fatos dos cards (Ano, Km, Câmbio) renderizam com `font-size: 12px`, padding compacto (`4.8px 5.6px`) e fundo translúcido discreto (`rgba(255, 255, 255, 0.055)`).
- **Sem poluição**: Não competem visualmente com a fotografia nem com o preço do veículo.

### 4. Assistente de IA (Chat)
- **Modelos e Fallback**: Primário `gemini-3.5-flash-lite`, secundário `gemini-2.5-flash-lite`, fallback terciário `deepseek/deepseek-v4.1-flash`.
- **Regra de Moto**: A função `resolveChatCategory` e os filtros de busca garantem que, em buscas com faixa de preço ou termos genéricos (ex: *"carros até 70 mil"* ou *"algo até 20 mil"*), nenhuma moto seja exibida, a menos que o usuário cite expressamente "moto" ou termos afins.
- **Timeout**: `maxDuration = 45` no route handler.

### 5. Eventos Meta (Pixel)
- Os eventos `AddToCart` e `Lead` são disparados conjuntamente com `content_ids = [vehicle.id]` e `content_type = "vehicle"`.
- O clique no WhatsApp em cards (`VehicleCardWhatsApp`), na ficha do veículo (`VehicleLeadHit`) e nas ações rápidas (`VehicleQuickActions`) garantem a integridade da mensuração de conversão exigida pelo Commerce Manager e pelas campanhas Advantage+.

---

## Prioridades e Plano de Ação

| Prioridade | Achado | Impacto | Esforço | Arquivos-alvo |
| --- | --- | --- | --- | --- |
| **P1** | Ocultar preço de vendidos em `publicCardFacts` e `FavoritesComparison` | Alto | Muito Baixo | `src/lib/public-card-facts.ts`, `src/components/site/FavoritesComparison.tsx` |
| **P2** | Corrigir duplicação de UF no JSON-LD de depoimentos | Médio | Muito Baixo | `src/lib/seo.ts` |
| **P3** | Substituir classes `amber-*` no chat por tokens neutros | Médio | Baixo | `src/components/site/SiteChat.tsx` |
| **P4** | Alinhar `revalidate = 3600` na página `/pedido` | Médio | Muito Baixo | `src/app/(site)/pedido/page.tsx` |
| **P5** | Limpeza de CSS morto (`.listing-card-city`) e hexadecimais soltos | Baixo | Baixo | `src/app/globals.css`, `src/components/site/*` |
| **P6** | Adicionar `force-dynamic` explícito em `/api/chat` | Baixo | Muito Baixo | `src/app/api/chat/route.ts` |
