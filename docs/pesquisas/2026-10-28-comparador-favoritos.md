# PR-2 parcial — comparador de favoritos

Aviso contextual com dois ou mais favoritos disponíveis, ação existente com indicação de até três veículos e tabela com rolagem interna. Nenhum botão novo nos cards, pedido de vídeo ou evento novo.

| Antes | Depois |
| --- | --- |
| Rótulos de 10 px em coluna de 48 px no celular | Rótulos completos de 12 px em coluna fixa de 112 px |
| Duas colunas comprimidas na largura disponível | Largura mínima de 480 px para dois veículos e 672 px para três, com rolagem dentro da tabela |
| Navegação por botões só com três veículos | Navegação por botões também com dois; alvos de pelo menos 44 px |
| Campo vazio como traço ou “Consulte” | “Não informado”, sem calcular diferenças com o dado ausente; zero km continua válido |

## Evidências visuais

Capturas locais com dados fictícios e placeholder local. Não houve download de fotos de produção. Capturas feitas em 360, 390, 430 e 1440 px; exemplos de 390 px abaixo. O ambiente de desenvolvimento usa os valores de fallback do site, sem banco conectado.

| Seleção | Antes | Depois |
| --- | --- | --- |
| Dois veículos | ![Antes, dois veículos](comparador-favoritos/antes-390-2.png) | ![Depois, dois veículos](comparador-favoritos/depois-390-2.png) |
| Três veículos | ![Antes, três veículos](comparador-favoritos/antes-390-3.png) | ![Depois, três veículos](comparador-favoritos/depois-390-3.png) |

## Validação e limites

`e2e/favoritos-comparador.spec.ts` cobre dois/três veículos nas quatro larguras, rolagem interna, ausência de overflow da página, toque de 44 px, máximo de três, ordem/seleção após recarregar, URL oficial do WhatsApp, campos ausentes e aviso condicionado à quantidade disponível. A API de favoritos é interceptada com fixtures; não requer seed nem alteração no banco.

`npm test`: 1.458 testes passaram. `npm run lint`: sem erros. Os seis cenários de navegador passaram na execução local.

`npm run build`: compilação e TypeScript passaram, mas a pré-renderização de `/modelos` falhou ao consultar o banco local desconectado (`127.0.0.1:1`). A consulta já existe em `src/lib/stock-landing-data.ts:8`. Nenhum banco foi criado, populado ou alterado. O build completo continua pendente no CI, que provisiona banco isolado.

`npm run build -- --experimental-build-mode compile`: passou, sem pré-renderização. Esse modo foi usado apenas para validar localmente; nenhuma configuração de build foi alterada no repositório.

Após compilar, `E2E_TEST=1 E2E_PORT=3374 npx playwright test e2e/favoritos-comparador.spec.ts --project=desktop`, com `DATABASE_URL` e `DIRECT_URL` apontando para `postgresql://postgres:postgres@127.0.0.1:1/garagem_e2e?connect_timeout=1`: seis testes passaram com `next start`, em 25,8 s. Cada teste ajusta sua própria largura, independentemente do nome do projeto Playwright.

Sora/Inter e tokens de cor existentes preservados. O token global `brand` em `tailwind.config.ts` ainda é `#D91519`; alinhar toda a marca a `#F80000` exige tarefa própria, como previsto no AGENTS.md.

Prioridade desta entrega: legibilidade e descoberta, impacto alto e esforço baixo. Pendência para revisão final: preview e medição Lighthouse antes/depois (LCP, INP e CLS); não foram gerados deploys para esta validação local. Pedidos de vídeo e novos eventos ficam para outra entrega do plano.
