# PR-0: baseline de UX e conversão

Data: 28/10/2026. Base: `main` em `f7fc678` (#393). Plano de referência: `PLANO-UX.md` v1.0 (28/10/2026).

Esta auditoria **não muda nenhum comportamento público**. O PR só adiciona este relatório e os prints de referência.

Ajustes do Lucas a este PR-0:

- Os prints ficam só em **390 px (mobile)** e **1440 px (desktop)**. Não fizemos 430 px nem tablet.
- **PR-3 (busca guiada) e PR-4 (formulários) ficam para depois.** As lacunas abaixo cobrem só PR-1, PR-6 e PR-2.
- O site usa **Sora nos títulos e Inter nos textos**. O §7 do plano fala em "preservar Barlow", mas isso está errado para o site: Barlow Condensed é só para vídeos e artes (AGENTS.md).

## 1. Método

- Leitura do código na `main` (arquivos listados no §1 do plano e o que eles importam).
- Prints e coleta automática de **todos os links `wa.me`** do site público (https://www.suagaragem.net). Foi um script Playwright local, com `--no-sandbox`, porque os MCPs de navegador não sobem nesta VM.
  - O consentimento **não foi aceito** e as chamadas para GA4, Meta e `/api/funil` foram bloqueadas no script. A visita não gerou evento nem registro no banco.
  - Favoritos e comparação foram simulados só no `localStorage`/`sessionStorage` do navegador de teste, com 3 veículos reais do estoque.
- Nada foi rodado contra o banco: sem seed, sem `db push` e sem `.env`.

### Prints de referência (`docs/ux-conversao/screenshots/`)

| Tela | Mobile 390 | Desktop 1440 |
|---|---|---|
| Home | `home-390.jpg` | `home-desktop.jpg` |
| Estoque | `estoque-390.jpg` | `estoque-desktop.jpg` |
| Ficha disponível (Fiat Fastback 2024) | `ficha-disponivel-390.jpg`, `ficha-disponivel-390-acoes-abertas.jpg` | `ficha-disponivel-desktop.jpg` |
| Ficha vendida (Honda Civic 2015) | `ficha-vendida-390.jpg` | `ficha-vendida-desktop.jpg` |
| Favoritos + comparador (3 veículos) | `favoritos-comparador-390.jpg` | `favoritos-comparador-desktop.jpg` |
| Pedido ("Não encontrou o modelo?") | `pedido-390.jpg` | `pedido-desktop.jpg` |
| Vender/Trocar | `vender-390.jpg` | `vender-desktop.jpg` |

Os prints são de página inteira, por isso a barra inferior e a barra fixa (`position: fixed`) aparecem no meio da imagem. O aviso de cookies aparece porque é a primeira visita.

## 2. O que já existe (confirmado no código e no site)

| Recurso | Evidência | Situação |
|---|---|---|
| **Pedir vídeo na ficha (desktop)** | `VehicleQuickActions.tsx:74`. Grade Financiamento / Troca / Pedir vídeo / Agendar visita, logo abaixo de "Falar no WhatsApp" (`page.tsx:536`) | Visível sem rolar no desktop (`ficha-disponivel-desktop.jpg`) |
| **Pedir vídeo na ficha (mobile)** | Barra fixa: link "Financiamento, troca ou vídeo" (`VehicleMobileBar.tsx:209`), que abre o painel com "Pedir vídeo" (`:122`). Dossiê: bloco "Vídeo e propostas", fechado por padrão (`VehicleMobileDossier.tsx:303`) | Fica a 1 toque. O texto "vídeo" aparece na barra o tempo todo (`ficha-disponivel-390-acoes-abertas.jpg`) |
| **Mensagem de vídeo com contexto** | `formatVehicleWhatsAppMessage({ ...vehicle, path, isMoto, intent: "video" })` (`page.tsx:191`) → `site.ts:172` | Exemplo real: "Oi! Vi o Fiat Fastback Audace T200 2024 por R$ 106.900 no site da Garagem e queria um vídeo dele." + link da ficha. A moto usa "dela" (testes em `site.test.ts:70` e `vehicle-display.test.ts:371`) |
| **Vídeo nunca reproduzido no site** | Nenhum `<video>` nem iframe de vídeo nas 7 telas × 2 larguras. O único `<iframe>` do código é o de sugestões do Google no chat (`SiteChat.tsx:337`) | Atendido. `hasVideo` entra no select do detalhe (`vehicles.ts:77`), mas não é renderizado em tela pública. O único uso fora do admin é `vehicle-dossier.ts`, que nenhuma tela importa |
| **Ficha vendida** | Sem quick actions nem vídeo (`page.tsx:665`). CTA "Pedir parecido no WhatsApp" com `ficha-vendido` (`:498`). Barra mobile mostra "Indisponível" e "Ver opções" (`:741`) | Mensagem real: "…Honda Civic LXR 2.0 FlexOne 2015 já foi vendido… quero ver opções parecidas". Sem preço e sem vídeo |
| **WhatsApp único** | `site.ts:9-12` (`5527996330706`). `whatsappUrl` ignora `phoneIndex` (`site.ts:411`) | Todos os links `wa.me` coletados nas 14 capturas usam `5527996330706`. O número antigo só aparece em testes que exigem a ausência dele |
| **Comparador de até 3 favoritos** | `FavoritesComparison.tsx` + `favorites-comparison.ts`. Seleção em `sessionStorage` (`garagem:comparacao`) e favoritos em `localStorage` (`garagem:favoritos`). Favoritos indisponíveis ficam fora (`FavoritesList.tsx:110`, `:231`) | Funciona com 3 veículos em 390 px: colunas por toque e rolagem interna (`favoritos-comparador-390.jpg`). Coberto no e2e (`e2e/README.md`) |
| **Assistente e vídeo** | Pedido de vídeo/fotos responde sem chamar o modelo de IA: "O consultor manda um vídeo do {veículo} pelo WhatsApp" (`chat-turn.ts:578-580`). O CTA vira "Pedir vídeo" com a mensagem do veículo (`chat-text.ts:471-480`, campanha `chat` + `utm_content` do veículo) | Não promete vídeo pronto nem diz que enviou |
| **Offline** | `TrackedWhatsAppLink` e a barra mobile guardam o clique sem rede (`queueWhatsAppIfOffline`). `SellForm` tem fila offline (`enqueueIntent`) e rascunho. `public/sw.js` | Existe. Não foi testado em rede real neste PR |

## 3. Mapa de eventos atual

### 3.1 Funções de envio (`src/lib/funnel-events.ts`)

| Função | Meta Pixel | GA4 | Log próprio (`/api/funil`) |
|---|---|---|---|
| `trackWhatsAppClick(label, ref)` (`:423`) | `trackCustom WhatsAppClick {label, vehicle_id, slug, utm_*}` | `whatsapp_click {event_label, vehicle_id, slug, utm_*}` | `site:whatsapp` em `AdminAudit` (`route.ts:72`), só com consentimento |
| `VehicleLeadHit` (`:666`), só com `contentId` | `Lead` + `AddToCart` (catálogo, `content_type=vehicle`) | `generate_lead` + `add_to_cart` | — |
| `trackCatalogWhatsAppClick` (`:352`), header/float na ficha **não vendida** | `Lead` + `AddToCart` | `generate_lead` + `add_to_cart` | — |
| `SiteLeadHit` (`:689`), CTA sem veículo | `Lead {content_name, search_string?}` | `generate_lead {search_term?}` | — |
| `VehicleViewContent` (`:602`), abertura da ficha | `ViewContent` + `trackCustom vehicle_view` | `view_item` + `vehicle_view` | `site:visita` por rota (`WhatsAppOrigin.tsx`) |
| `StockSearchPixel` (`:717`) | `Search {search_string}` | `search {search_term}` | — |
| `trackChatEvent` (`:475`) | `ChatOpen`, `ChatFirstMessage`, …, `ChatLeadCreated` | `chat_*` | — |
| `trackEvent` (`track-event.ts`) | `ChatMessageSent`, `ChatVisitRequest` | `chat_message_sent`, `chat_visit_request` | — |
| `trackPwaEvent` | `Pwa*` | `pwa_*` | — |

GA4 e Pixel só carregam com consentimento (`MarketingScripts.tsx`). Sem eles, os stubs só enfileiram e o link abre normalmente. O `/api/funil` também exige consentimento e guarda só `origem`, evento e `vehicleId`, sem URL, IP nem UTM livre.

### 3.2 O que um clique dispara, por CTA

| CTA (tela) | Rótulo `label` | UTM `campaign` / `content` | Meta | GA4 | Log |
|---|---|---|---|---|---|
| Falar no WhatsApp (ficha desktop) | `ficha` | `ficha` / slug | WhatsAppClick + Lead + AddToCart | whatsapp_click + generate_lead + add_to_cart | whatsapp |
| Tenho interesse (barra mobile da ficha) | `ficha-mobile` | `ficha` / slug | idem | idem | whatsapp |
| **Pedir vídeo** (ficha desktop, dossiê, barra mobile) | **`ficha-video`** | `ficha` / slug | idem | idem | whatsapp |
| Financiamento / Troca / Agendar visita (ficha) | `ficha-finance` / `ficha-trade` / `ficha-visit` | `ficha` / slug | idem | idem | whatsapp |
| Pedir parecido (ficha vendida) | `ficha-vendido` | `ficha` / slug | só WhatsAppClick | só whatsapp_click | whatsapp |
| Pedir outros nesta faixa (ficha) | `ficha-mesma-faixa` | `ficha` / slug | WhatsAppClick | whatsapp_click | whatsapp |
| Header / float / nav na ficha | `header`, `header-menu`, `float`, `nav-mobile` | `ficha` / slug | WhatsAppClick + Lead + AddToCart (não vendida) | idem | whatsapp |
| Tenho interesse (card do estoque/home) | `vehicle-card` | `estoque` / slug | WhatsAppClick + Lead + AddToCart | idem | whatsapp |
| **Tenho interesse (comparador)** | `comparacao-favoritos` | `favoritos` / **vazio** | **só WhatsAppClick** | **só whatsapp_click** | whatsapp |
| Falar no WhatsApp (lista de favoritos) | `favoritos-lista` | `favoritos` / slugs | WhatsAppClick + Lead (ids) | whatsapp_click + generate_lead | whatsapp |
| Chat: qualquer CTA, inclusive **"Pedir vídeo"** | `chat` | `chat` / slug | só WhatsAppClick | só whatsapp_click | whatsapp |
| Avise-me / busca vazia / `home-wanted` / `home-vender` / "Prefiro chamar no WhatsApp" (vender) | `avise-me`, `home-wanted`, `home-vender`, `vender` | `estoque` / `home` | WhatsAppClick + Lead (sem id) | whatsapp_click + generate_lead | whatsapp |
| Demais CTAs gerais (`home-hero`, `home-final`, rodapé, FAQ, contato…) | rótulo da tela | campanha da rota | só WhatsAppClick | só whatsapp_click | whatsapp |
| Envio do "Não encontrou o modelo?" | — | — | Lead `{content_name, search_string = modelo digitado}` | generate_lead `{search_term}` | lead gravado no banco pela action |
| Envio de Vender/Trocar | — | — | Lead `Vender/Trocar` | generate_lead | lead gravado no banco (ou na fila offline) |

Cada clique da ficha dispara **uma vez** cada evento (Lead, AddToCart e WhatsAppClick), sem duplicar. Os testes unitários de payload estão em `meta-pixel.test.ts` e `funnel-events.test.ts`. Não há teste e2e que conte eventos por clique.

## 4. Lacunas reais

### PR-1: vídeo pelo WhatsApp

1. **A descoberta no mobile depende de um toque.** "Pedir vídeo" não aparece direto na primeira dobra mobile: só dentro de "Financiamento, troca ou vídeo" na barra fixa e no acordeão "Vídeo e propostas", fechado por padrão. A palavra "vídeo" está sempre visível na barra. Decidir com o Lucas se basta (o plano diz para não mexer se já estiver visível) ou se cabe só a microcopy sutil perto da área existente. **Não criar botão novo.**
2. **No desktop não há microcopy de vídeo.** A grade mostra "Pedir vídeo", mas o texto abaixo é genérico ("Esses botões também abrem o WhatsApp deste veículo", `page.tsx:552`). Candidato à microcopy "Quer ver mais detalhes? Peça um vídeo pelo WhatsApp."
3. **Falta teste e2e do CTA de vídeo.** Nenhum spec confere, em 390 e 1440 px, que "Pedir vídeo" abre `wa.me/5527996330706` com "queria um vídeo dele/dela" e o link da ficha, que dispara um único `ficha-video` e que não aparece na ficha vendida. Hoje só há teste unitário da mensagem.
4. **Assistente: o pedido de vídeo não é medido.** O CTA "Pedir vídeo" do chat registra `label=chat`, igual a qualquer outro CTA do chat. Não dá para contar pedidos de vídeo vindos do assistente (ver PR-6, item 1).
5. **Mensagem e vendido: já atendidos.** O contexto da mensagem (modelo, ano, link, moto "dela") e o vendido sem CTA de vídeo já funcionam. Não reimplementar; só cobrir com e2e.

### PR-6: continuidade e atribuição do WhatsApp

1. **Os CTAs do chat não têm rótulo por intenção.** Todos usam `trackWhatsAppClick("chat")` (`SiteChat.tsx:224`, `:1180`, `:1388`, `:1410`). Sugestão: rótulo `chat-video`, `chat-finance` etc. derivado da intenção que `chat-text.ts` já calcula, **sem** evento novo.
2. **Texto livre sai para Meta e GA4.** O envio do "Não encontrou o modelo?" manda o **modelo digitado** como `search_string`/`search_term` (`MissingModelForm.tsx:135-139`). A busca do estoque manda o `q` digitado (`stockSearchString`, `funnel-events.ts:510`). O plano proíbe texto livre e `search_string` sensível. Avaliar trocar por categoria/marca normalizada ou remover o campo. Isso mexe em evento da Meta: combinar com o Lucas antes.
3. **O comparador não identifica o veículo na UTM.** "Tenho interesse" do comparador vai sem `utm_content` (`FavoritesComparison.tsx:121-125`). A mensagem tem o link, mas a UTM não diz qual veículo. Passar `content` com o slug, como fazem o card e a ficha.
4. **O mesmo "Tenho interesse" dispara eventos diferentes.** No card ele dispara Lead + AddToCart. No comparador, só WhatsAppClick. Decidir com o Lucas se o comparador deve entrar no AddToCart (campanha da Meta) ou ficar de fora de propósito. Não duplicar.
5. **"Agendar visita" está certo.** O desktop e a barra mobile usam `ficha-visit`, com o texto "quero ver ele de perto". Não promete horário nem endereço. Nada a fazer.
6. **Falta um dicionário central de rótulos.** Os rótulos são strings soltas em cada componente (`ficha-video` aparece duplicado em `VehicleQuickActions.tsx:74` e `VehicleMobileBar.tsx:122`). Centralizar os nomes e testar "um evento por ação", como o §3 do plano pede.
7. **Clique não é conversa.** O site só mede o clique de saída (`whatsapp_click` e `site:whatsapp`). Conversa recebida e lead qualificado dependem de registro da equipe no admin, que fica fora deste ciclo.

### PR-2: comparador existente

1. **O comparador é pouco descoberto.** Ele aparece como `<details>` fechado ("Comparar favoritos") na página de favoritos. Não há texto contextual quando há 2+ favoritos, nem sinal perto do coração do header.
2. **O uso do comparador não é medido.** Abrir/fechar (`onToggle`) e marcar veículos não geram evento. Faltam `favorites_compare_open` e `favorites_compare_vehicle_selected`, sem PII.
3. **Não há pedido de vídeo no comparador.** Hoje só existe "Tenho interesse" + "Abrir anúncio". Para o pedido de vídeo, reutilizar `intent: "video"` por veículo; para dois veículos, usar uma mensagem única no estilo de `favoritesListWhatsApp`.
4. **Campo ausente aparece como "—"** em "Versão" e "Câmbio" (`FavoritesComparison.tsx:29`). O plano pede "Não informado".
5. **Atribuição:** ver PR-6, itens 3 e 4.
6. **Toque e leitura em 390 px:** o CTA já tem 56 px de altura, os seletores de coluna têm `min-h-11` e há rolagem interna. A terceira coluna fica cortada até tocar ou deslizar, o que é intencional (`favoritos-comparador-390.jpg`). Revisar o contraste do texto `text-[10px]` das notas de diferença.

## 5. Checklist de regressão (para PR-1, PR-6 e PR-2)

- **Comercial:** só `wa.me/5527996330706`. Card inteiro clicável com o único botão "Tenho interesse". Barra inferior com Início, Estoque, WhatsApp, Vender e Favoritos. Barra fixa da ficha com "Tenho interesse". Nenhum `<video>` nem embed. Ficha vendida sem preço e sem vídeo.
- **Eventos:** um `WhatsAppClick` por clique. Lead e AddToCart só onde já existem (tabela 3.2). Nada de texto livre nem PII. O link abre mesmo com analytics bloqueado.
- **SEO:** ficha vendida com `noindex, follow` e "(vendido)" no título. Canonical pelo slug. JSON-LD sem preço quando vendido. Sitemap com `revalidate = 300`.
- **Performance:** LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1 no celular, medidos no preview antes e depois. Sem `next/image` novo. Sem hidratação extra na ficha.
- **Acessibilidade:** `aria-label` em todos os CTAs de WhatsApp (já existem). Foco visível. Esc fecha o painel da barra mobile (já existe). Alvos de toque ≥ 44 px.
- **Offline:** clique sem rede vai para a fila (`queueWhatsAppIfOffline`). Rascunho e fila do Vender/Trocar continuam funcionando.

## 6. Resultado dos comandos (local, 28/10/2026)

| Comando | Resultado |
|---|---|
| `npm test` | **OK**: 1458 testes, 1458 passaram, 0 falhas |
| `npm run lint` | **OK** (exit 0) |
| `npx tsc --noEmit` e `npx tsc --noEmit --project tsconfig.test.json` | **OK** (exit 0) |
| `npm run build` | 1ª execução: compilou e gerou as 68 páginas, mas terminou com `SecurityFatalError` (aviso de segurança do Next.js 16.4.2, a mesma pendência já registrada em `docs/pesquisas/2026-10-22-auditoria-painel-admin.md`). A mensagem pede para repetir. 2ª execução: **OK** (exit 0, 68/68 páginas) |

O build rodou com `DATABASE_URL` apontando para um Postgres local **sem acesso** (credenciais do CI). As consultas de pré-geração falharam com "Authentication failed" e as páginas saíram sem dados, como o código prevê. Nenhum dado de produção foi lido.

**Não rodou:** `npm run test:e2e` (exige banco local com seed, vetado nesta tarefa) e Lighthouse/DevTools (os MCPs de navegador não sobem nesta VM). O e2e roda no CI deste PR.

**Recomendação à parte (fora do escopo):** atualizar o Next.js por causa do aviso de segurança, em PR próprio da área `infra`.
