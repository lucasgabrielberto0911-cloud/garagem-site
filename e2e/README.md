# Percursos públicos no navegador

O CI verifica a versão de produção do Next, com PostgreSQL local, em 320, 390, 430 e 1440 px. Cobre busca com erro de digitação, card/ficha/retorno, favoritos/comparação de três veículos/WhatsApp, cookies novos e já aceitos, 404, redirecionamento e ficha vendida sem preço. Erros de JS e de hidratação falham os testes. A cidade dos veículos fica ausente da API e da comparação; a terceira coluna e seu contato continuam acessíveis no celular.

As amostras de Civic, Duster e HR-V são um retrato público de 08/10/2026; o registro vendido é uma **simulação local**. As fotos são substituídas por um arquivo local para o CI não depender do Storage. Estes testes não medem velocidade/qualidade de fotos: isso exige a conferência visual e de rede no preview.

Para executar, use um banco exclusivo `ci` ou `garagem_e2e` em localhost, sem notificações/webhooks, e `E2E_TEST=1`. Depois de `npm ci`, `prisma generate` e `prisma db push`, execute `npm run e2e:seed`, `npm run build`, `npx playwright install chromium` e `npm run test:e2e`. A configuração inicia o servidor local automaticamente. Nenhuma credencial de produção é necessária.

Os PRs só devem ser mergeados depois dos checks **e** da leitura do diff/conferência visual. Configure o check `CI / check` como obrigatório na proteção da main para impedir o merge manual com falhas; este PR não muda permissões do GitHub.

## IA privada do admin

`e2e/admin-ia.spec.ts` cobre revisão e melhoria da legenda, textos do site/FAQ/links e ajuda.
Com o banco local e o build já preparados, rode `E2E_ADMIN_AI_MOCK=1 npm run test:e2e -- e2e/admin-ia.spec.ts`.
O servidor carrega `e2e/admin-ai-provider.cjs`, que intercepta a chamada NVIDIA e aceita somente uma chave fictícia.
Sessão, origem, limite por admin, parsers e formulários usam o código real. Não há modo mock na aplicação publicada.
O CI executa essa rodada no shard 1; a rodada normal cobre o aviso sem chave.
Para repetir só a indisponibilidade: `ADMIN_AI_NVIDIA_API_KEY='' NVIDIA_API_KEY='' npm run test:e2e -- e2e/admin-ia.spec.ts --grep 'sem chave'`.
Os testes criam e removem apenas um admin e um veículo fictícios no banco local; aplicar/descartar sugestões não salva anúncio nem dados do site.

## Compatibilidade WebKit e service worker

Com as mesmas variáveis e build local, execute `npx playwright install --with-deps webkit`
e `npx playwright test --config=playwright.compat.config.ts`. O shard 1 do CI também executa essa suíte,
e suas falhas impedem o agregador `check` de passar.
O job E2E usa Ubuntu 24.04: a versão fixada do Playwright (1.57) não suporta WebKit em Ubuntu 26.04.

O WebKit cobre login, fonte dos campos, foco, erro acessível, largura e preservação do cadastro
ao recusar saída em 320, 390 e 430 px. O administrador é fictício e removido ao terminar;
nenhum cadastro de cliente ou depoimento é gravado. Isso não substitui teclado/zoom em iPhone físico.

O Chromium permite service workers numa origem HTTP local exclusiva por teste. Usa o código
real de `public/sw.js` com versão de deploy controlada e HTML fictício: atualização sem perder
formulário, ativação do controlador novo, limpeza do cache antigo, navegação
offline, fallback da ficha e reconexão. As requisições externas são bloqueadas. O teste
de atualização verifica o ciclo do SW; não simula um deploy completo do Next nem o envio de leads.

## Conversa HTTP com filtros de vendedor

Com o banco local dedicado e `E2E_TEST=1`, rode `E2E_CHAT_CONVERSA=1 npm run e2e:seed`
para acrescentar o Palio Weekend 2016 manual de R$ 47.900. O km dessa fixture é fictício.
Use essa fixture depois da suíte de navegador, que espera os três anúncios originais.
Com os servidores parados, mova `.next/cache` para uma pasta temporária para não
consultar o estoque anterior ao seed. Recompile com `npm run build`, inicie com
`npm run start -- --port 3311` e rode
`BASE_URL=http://localhost:3311 node scripts/chat-conversa-e2e.mjs`.

O script consulta o estoque público antes da conversa: exige motos quando existem e
confere a resposta de ausência quando não existem. A seleção de motos com estoque
fake e as alternativas de câmbio dentro da faixa têm cobertura em
`src/lib/chat-sales-search.test.ts`. Use Node 24, como no CI, para a suíte completa.
