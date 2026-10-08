# Percursos públicos no navegador

O CI verifica a versão de produção do Next, com PostgreSQL local, em 320, 390, 430 e 1440 px. Cobre busca com erro de digitação, card/ficha/retorno, favoritos/comparação/WhatsApp, cookies novos e já aceitos, 404, redirecionamento e ficha vendida sem preço. Erros de JS e de hidratação falham os testes.

As amostras de Civic, Duster e HR-V são um retrato público de 08/10/2026; o registro vendido é uma **simulação local**. As fotos são substituídas por um arquivo local para o CI não depender do Storage. Estes testes não medem velocidade/qualidade de fotos: isso exige a conferência visual e de rede no preview.

Para executar, use um banco exclusivo `ci` ou `garagem_e2e` em localhost, sem notificações/webhooks, e `E2E_TEST=1`. Depois de `npm ci`, `prisma generate` e `prisma db push`, execute `npm run e2e:seed`, `npm run build`, `npx playwright install chromium` e `npm run test:e2e`. A configuração inicia o servidor local automaticamente. Nenhuma credencial de produção é necessária.

Os PRs só devem ser mergeados depois dos checks **e** da leitura do diff/conferência visual. Configure o check `CI / check` como obrigatório na proteção da main para impedir o merge manual com falhas; este PR não muda permissões do GitHub.
