# TAREFA: polimento visual da ficha do anúncio no celular

Você é o autor deste PR. Trabalho em `~/wt/melhorias-ficha`, branch `reserva/melhorias-ficha`, partindo de `origin/main` @ 93bddfe. Um PR só, focado nesta página. Esforço medium (não mínimo, não fast).

## 0. Pesquisa já feita — NÃO use WebSearch, WebFetch nem Google Search

Não chame ferramentas de pesquisa ou fetch na web. Use só estes princípios (já levantados pelo coordenador), cite as URLs no corpo do PR e comece a implementar na hora. Não copie layout de concorrente.

- No primeiro ecrã do celular: foto, título, preço e um CTA principal — o comprador precisa ver isso sem procurar. Fonte: https://carvia.ai/automotive-research/vdp-excellence e https://dev.to/mohammed_ragab_5714509847/ux-lessons-from-building-better-online-car-buying-experiences-26ki
- Barra fixa no rodapé com o CTA (já existe `VehicleMobileBar`); botões principais ≥56px; 1 CTA principal + no máximo 1–2 secundários; contraste alto. Fonte: https://carvia.ai/automotive-research/vdp-excellence
- Fotos grandes e deslizáveis; repetir o CTA depois da galeria, das especificações e dos selos de confiança; a barra fixa não pode cobrir conteúdo (padding + safe-area). Fonte: https://cartradewebsites.com/designing-vehicle-detail-pages-that-drive-inquiries
- Não sobrecarregar o topo com vários CTAs; título, preço e fotos vêm primeiro. Fonte: https://www.dealer.com/resources/turn-details-into-deals/
- Nome e preço sempre à vista, com a ação embaixo. Fonte: https://www.eelkr.com/projects/car-resale

Restrição nossa (passa na frente de qualquer fonte): **nunca mostre valor de parcela, nunca coloque simulador, nunca use as palavras "Simular" ou "simulação"** nas páginas públicas. "Financiamos em até 60x" pode.


## 1. Escopo (obrigatório)

Melhorar o visual e o uso no **celular** da ficha do anúncio:

- Página: `src/app/(vehicle)/estoque/[id]/page.tsx` (rota `/estoque/[id]`, também acessível por slug).
- Componentes ligados: `VehicleMobileBar`, `VehicleMobileDossier` / `VehicleMobileSummary` / `VehicleMobileBlocks`, `VehicleGallery`, e o que for estritamente necessário (CSS em `globals.css`, testes em `src/lib/ficha-cta.test.ts` e e2e da ficha).

Direção (sem redesenhar a página inteira):
- Hierarquia mais clara no celular: foto, título, preço e o CTA principal de WhatsApp aparecem cedo, fáceis de ler com uma mão.
- Mais profundidade e cor profissional: cards, espaçamento, contraste, seções que não pareçam um bloco único. Vermelho da marca como cor principal; pode usar mais combinações de cor, **nunca dourado/amarelo**.
- Botões e textos grandes; CTAs principais ≥56px.
- O botão principal de WhatsApp é **verde `#25D366`**, letra branca (já é o padrão do site). O assistente, se aparecer, continua **vermelho**.
- A barra fixa do WhatsApp no celular (`VehicleMobileBar`) permanece: preço + "Chamar no WhatsApp" (ou o texto atual) sempre à vista enquanto rola, sem cobrir conteúdo (padding inferior suficiente, inclusive safe-area). Pode polir o visual da barra, sem quebrar o comportamento nem os testes.
- Fotos **4:3 com fundo desfocado** (padrão `VehicleImage` / galeria já existente). Não inventar outro recorte, não borrar placa, não mudar cor, não tirar o fundo da foto.
- No desktop, **não** volte o card lateral a `lg:sticky`. O Lucas já pediu "um scroll só" (ficha do Uno 2013; #449). O draft #515 existe por isso e **não deve ser reaberto, rebaseado nem mergeado neste PR**. O aside do desktop fica no fluxo, como está na main.
- Não mostre parcela nem simulador. "Financiamos em até 60x" pode, se já existir ou couber num selo curto, sem inventar número de parcela.
- Textos em linguagem simples, sem termo técnico. Transmissão só Manual/Automático (CVT e Xtronic podem). Motor só por cilindrada; sem cv e sem número de marchas.
- Nunca "loja digital". Usar "Atendemos Linhares, Aracruz e Grande Vitória" / "Combinamos o atendimento pelo WhatsApp" se precisar de texto de atendimento.

Fora deste PR:
- home e /estoque (lista)
- /vender, /sobre, /contato, footer (outras rodadas)
- admin, depoimentos, `.env`, chaves, Supabase, prisma
- draft #515 / branch `reserva/ficha-sticky`

## 2. Qualidade, git e PR

- Rode as suítes tocadas (`src/lib/ficha-cta.test.ts` e outras que você alterar) + lint + `npm run check` (ou o equivalente) e `tsc` se couber. Corrija o que você quebrar.
- Não rode o e2e Playwright completo localmente se for longo demais; ajuste os specs da ficha que você alterar (`e2e/ficha-*.spec.ts`).
- Commits claros em português ou inglês, só desta tarefa. Sem WIP inútil, **sem `TAREFA.md` no commit** (deixe o arquivo untracked).
- **Push:** `git push -u origin HEAD:reserva/melhorias-ficha` — **sem force**, **nunca para main**. Se o push falhar por sandbox/`GIT_CONFIG`, não insista com force; deixe o commit local que o coordenador empurra.
- Abra um **PR draft** contra `main` com `gh pr create --draft`. Título e corpo em português, claros para o Lucas. No corpo: o que mudou no celular, o que não mudou no desktop (sem sticky), as fontes da pesquisa, e que #515 não foi aproveitado (e por quê).
- **NÃO faça merge. NÃO promova para produção. NÃO force-push. NÃO rode `prisma db push`. NÃO mexa em produção/Supabase/.env.**
- Não revise o próprio trabalho com o mesmo modelo; outro agente vai revisar.

Quando terminar: deixe o PR draft aberto (ou os commits prontos) e encerre com um resumo do que mudou, arquivos, testes rodados, uso de tokens se o ambiente mostrar, e o link do PR se existir.
