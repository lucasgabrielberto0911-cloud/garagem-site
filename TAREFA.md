# TAREFA: melhorias visuais (páginas novas + celular) e WhatsApp verde no topo da home

Você é o autor deste PR. Trabalho em `~/wt/melhorias-neon`, branch `reserva/melhorias-neon`, partindo de `origin/main` @ 0a77592. Um PR só. Esforço medium (não mínimo, não fast).

## 0. Antes de implementar: pesquisa na web

Pesquise boas práticas atuais (2025–2026) de landing pages e sites mobile de revenda de seminovos / concessionárias:
- hierarquia visual, cards com profundidade, seções com fundo alternado
- CTAs grandes no celular, contraste, alvos de toque (≥56px nos principais)
- uso de fotos reais do estoque (não banco de stock genérico)
- pages institucionais e hubs de links (link-in-bio) com cara de marca, não lista seca

Anote as fontes (URLs + o que aproveitou) no corpo do PR. Não copie layout de concorrente; só princípios.

## 1. Escopo das páginas (obrigatório)

As 3 páginas novas mais sem graça, confirmadas no código e no HTML de produção de suagaragem.net (main 0a77592). Não há prints 390px recentes dessas rotas (só de home, /estoque e ficha).

1. **/links** (`src/app/links/page.tsx` + `LinksHub`): hub de bio bem seco — wordmark, título e lista de botões; sem fotos, sem seções, sem profundidade (0 shadow no page).
2. **/como-funciona** (`src/app/(site)/como-funciona/page.tsx`): página nova (#496, 16/11). Passos em texto, sem cards, sem sombra, sem fotos do estoque.
3. **/financiamento** (`src/app/(site)/financiamento/page.tsx`): página nova (#496/#522). Já tem ícones e grades, mas está plana (0 shadow, quase sem foto de carro). Pode usar mais cor, cards, fundos alternados e fotos reais do estoque.

Melhore também o celular nessas páginas (espaçamento, hierarquia, botões grandes, leitura com uma mão, seções que não pareçam um bloco único cinza/preto).

Páginas que NÃO entram neste PR (exceto o item 2 abaixo, pontual na home):
- layout e conteúdo da home e do /estoque (continuam limpos, sem busca/atalhos/filtros)
- fichas de veículo (já tiveram várias levas visuais)
- /sobre (já tem founder, selos, fotos, gradiente)
- /troca (formulário acabou de ser simplificado no #528)
- admin, depoimentos, .env, chaves, Supabase, prisma

## 2. Pedido extra do Lucas (obrigatório, mesmo PR)

O botão **"Falar no WhatsApp" do topo da home** (hoje vermelho, `WhatsAppButton` solid = `bg-brand text-cream`, em `.hero-cta` de `src/app/(catalog)/page.tsx`) passa a ser **VERDE**, o mesmo verde do WhatsApp da barra de baixo:

- fundo `#25D366` (já usado em `MobileBottomNav`, flutuante e barra da ficha)
- **letra branca** (`text-white` / `text-cream` se cream for branco puro; não usar `text-asphalt`)
- mesmo tamanho dos outros botões do topo: **≥56px**, `rounded-xl`, lado a lado no desktop e empilhados largura total no celular
- o botão **"Pergunte ao assistente" continua vermelho cheio**, texto branco, ícone, ≥56px (contraste com o verde do WhatsApp)
- "Ver estoque" permanece outline, como está

Pode (e deve, se fizer sentido) trocar também os **outros CTAs principais de WhatsApp** (ex.: variante solid de `WhatsAppButton` em `src/components/site/ui.tsx`, CTAs "Falar no WhatsApp" de páginas de apoio) para o mesmo verde + letra branca, para o padrão ficar consistente. Não mude o assistente (vermelho). Não mude a barra inferior nem o flutuante verde (já estão certos). Não pinte de verde botão que não for CTA de WhatsApp.

Ajuste testes e2e/unitários que confiram a cor do botão do topo ou da variante solid. Em especial:
- `e2e/home-barra-standalone.spec.ts`: o teste "três botões grandes no topo" hoje afirma que o **assistente** é vermelho (`--brand`, R≥180, G/B≤60, texto branco). Mantenha essa asserção no assistente. Se algum teste (ou um novo) conferir a cor do WhatsApp do hero, ele deve ser verde `#25D366` (rgb 37, 211, 102) com texto branco, altura ≥56. Não quebre a asserção vermelha do assistente.
- Procure outros testes que esperem `bg-brand` no `WhatsAppButton` solid ou no link "Falar no WhatsApp" do `.hero-cta` e atualize.

## 3. Direção visual

Pode usar mais cor e mais profundidade: cards, ícones, seções com fundo alternado, fotos reais do estoque (veículos próprios / não consignados, pelas APIs já usadas no site), hierarquia e espaçamento. Profissional, letras e botões grandes, formulários simples.

Regras fixas:
- vermelho da marca como cor principal do site, **nunca dourado** (nem gold, amber de "luxo", `#FFD...`)
- o verde `#25D366` é só para WhatsApp
- fontes **Sora** (display) e **Inter** (texto) — `font-display` / o que o site já usa
- barra fixa do WhatsApp no celular permanece
- fotos **4:3 com fundo desfocado** (componente `VehicleImage` / padrão já existente); não inventar outro recorte
- sem valor de parcela e **sem simulador** ("Financiamos em até 60x" pode)
- nunca "loja digital": usar "Atendemos Linhares, Aracruz e Grande Vitória"; atendimento combinado pelo WhatsApp
- não mexer em depoimentos, `.env`, chaves, Supabase de produção
- nunca `prisma db push`
- não usar dados reais de cliente nos testes (fixtures já existentes)
- transmissão em copy só Manual/Automático (CVT e Xtronic podem); motor só por cilindrada; sem cv e sem número de marchas
- não alterar fotos (não borrar placa, não mudar cor, não tirar fundo)

## 4. Qualidade, git e PR

- Rode `npm test` (ou as suítes tocadas) + lint + `npm run check` (ou o equivalente do repo) e `tsc` se couber. Corrija o que você quebrar.
- Não rode e2e Playwright completo localmente se for longo demais; ajuste os specs que você alterar.
- Commits claros em português ou inglês, só desta tarefa. Sem WIP inútil, sem `TAREFA.md` no commit (deixe o arquivo untracked).
- **Push:** `git push -u origin HEAD:reserva/melhorias-neon` — **sem force**, **nunca para main**. Se o push falhar por sandbox/`GIT_CONFIG`, não insista com force; deixe o commit local que o coordenador empurra.
- Abra um **PR draft** contra `main` com `gh pr create --draft`. Título e corpo em português, claros para o Lucas. No corpo: o que mudou em cada página, o WhatsApp verde, as fontes da pesquisa web, e que home/estoque (layout) não foram redesenhados.
- **NÃO faça merge. NÃO promova para produção. NÃO force-push. NÃO rode `prisma db push`. NÃO mexa em produção/Supabase/.env.**
- Não revise o próprio trabalho com o mesmo modelo; outro agente vai revisar.

Quando terminar: deixe o PR draft aberto (ou os commits prontos) e encerre com um resumo do que mudou, arquivos, testes rodados e o link do PR se existir.
