# Auditoria de backend e performance pública — Garagem

## Resumo

Auditoria de APIs públicas, consultas Prisma, ISR/cache, imagens e dependências do cliente. As três prioridades implementadas são reutilizar o estoque diário entre páginas, consolidar as consultas dos filtros e permitir revalidação HTTP de imagens sem reenviar bytes. Alterações autorizadas expressamente nesta tarefa, na branch `melhorias/codex-out12`.

## Prioridades: impacto × esforço

| Prioridade | Evidência anterior | Implementação | Impacto esperado | Esforço |
| --- | --- | --- | --- | --- |
| 1 | Cada página diária carregava todos os cards, fotos e histórico; páginas 2+ devolviam total zero | Conjunto diário compartilhado e contagem compartilhada nas outras ordenações | Uma carga completa por combinação de filtros/data durante a validade do cache, em vez de uma por página; `hasMore` correto | Médio |
| 2 | O cache dos filtros executava sete `groupBy` e um `findMany`; acessórios limitados aos primeiros 400 registros | Uma projeção de campos de filtro com deduplicação em memória | Oito consultas viram uma por atualização de cache; filtros excluem históricos e abrangem todos os acessórios | Baixo |
| 3 | O proxy de fotos aceitava somente 200 e ignorava os validadores do navegador | Encaminhar `If-None-Match`/`If-Modified-Since` e aceitar 304 | Corpo vazio quando o Storage confirma a versão; menos transferência na revalidação | Baixo |

Os ganhos de consultas acima vêm do código, não são estimativas de latência em produção. O ganho de imagens depende de o Storage fornecer validadores e responder 304. Não há acesso de escrita ao banco real.

## Evidências e decisões

### APIs e consultas

- `src/lib/vehicles.ts:508`: cache do conjunto diário usa a mesma chave para todos os tamanhos/páginas, mantendo filtros e data de São Paulo. Fotos e selo de queda de preço continuam com os campos e regras existentes (`src/lib/public-vehicle-cards.ts:33`).
- `src/lib/vehicles.ts:522`: total nas ordenações do banco tem cache próprio; consulta de cards e contagem podem executar em paralelo. Páginas posteriores mantêm `total` e `totalPages`, corrigindo o cálculo de `hasMore` de `/api/estoque`.
- `src/lib/vehicles.ts:469`: a chave precisa permitir reconstrução dos filtros. Acessórios agora continuam sendo um array e preservam a grafia exigida pelo `hasEvery`, em vez de virar uma string separada por `|`.
- `src/lib/vehicles.ts:727` e `src/lib/stock-facets.ts:22`: uma consulta seleciona somente categoria, marca, modelo, transmissão, combustível, cor, ano e acessórios. Não seleciona fotos, preços ou dados de operação. Usa o mesmo critério público de status/histórico do sitemap.
- `/api/veiculos` limita a 60 ids e usa projeção pública, mas consulta o banco a cada chegada à Function; seu cache é privado por 30 segundos (`src/app/api/veiculos/route.ts:4`, `:36`). Candidato futuro para compartilhar consultas por conjunto de ids, após medir tráfego de favoritos.
- Feed Meta continua fora do ISR, com cache de CDN e filtro de disponibilidade. Downloads JPEG continuam separados das Functions leves; o download público possui limite de requisições e a imagem do catálogo possui cache de CDN. Nenhuma dessas rotas foi alterada.
- Health check mantém diagnóstico completo restrito à sessão administrativa; o acesso anônimo faz uma consulta de disponibilidade. Candidato futuro para medir frequência de probes antes de acrescentar cache.
- Índices existentes incluem status/data, status/preço, status/marca e fotos por veículo/ordem (`prisma/schema.prisma:81`, `:100`). Não há migrações neste lote; não se afirma qualidade de planos de execução sem `EXPLAIN` e volume representativo.

### Cache e ISR

- Home, estoque e ficha conservam 600 segundos (`src/app/(catalog)/page.tsx:48`, `src/app/(catalog)/estoque/page.tsx:17`, `src/app/(vehicle)/estoque/[id]/page.tsx:66`). Sitemap conserva 300 segundos (`src/app/sitemap.ts:13`). O build confirmou essas rotas pré-renderizadas.
- Novos caches usam `PUBLIC_CACHE`, com 600 segundos e `VEHICLES_PUBLIC_CACHE_TAG` (`src/lib/vehicles.ts:49`). A chave da página passa de v16 para v17; a dos filtros, de v6 para v7, para não reaproveitar formatos antigos.
- Conteúdo permanece em `site-settings`, com 3600 segundos; informações verificadas da ficha usam a tag pública. Metadata e página compartilham a leitura do veículo, e as seções adicionais já consultam em paralelo.
- Invalidação administrativa existente preservada: tag pública, home, estoque, sitemap e slugs específicos (`src/lib/public-stock-revalidate.ts:16`). Não foi introduzida invalidação geral de fichas nem rota dinâmica nova.
- O cache da CDN de `/api/estoque` tem validade independente de 120 segundos e stale-while-revalidate de 300 segundos. Este lote não promete atualização instantânea dessa camada.
- O conjunto diário continua contendo todos os cards. Estoques muito maiores podem exigir cache apenas de ids e busca paginada dos cards para limitar o tamanho da entrada. Há ainda cache por página; expirações e revalidação em segundo plano podem produzir janelas de atualização distintas. A invalidação por tag cobre as novas entradas.

### Imagens e bundle

- `src/lib/public-photo-http.ts:12` e `:41`: validadores públicos são encaminhados, 304 volta sem corpo; cookies e autorização não são encaminhados. Cache de miniaturas substituíveis continua semanal; imagens versionadas continuam anuais. Erros continuam `no-store`; streaming e fallback de preview permanecem.
- `next.config.mjs:20`: o otimizador da Vercel continua desligado conforme a cota Hobby. Nenhuma transformação ou variante nova foi criada.
- `src/components/site/VehicleGallery.tsx:29`: lightbox já tem importação dinâmica. `stock-query` separa tipos/helpers usados no cliente do módulo Prisma. `next.config.mjs:34` e `:40` externalizam pacotes de imagem e excluem dependências pesadas das Functions leves. Não houve alteração de componentes, fontes, chat ou assistente.
- Medição HTTP local do build final: soma dos arquivos JS referenciados por `<script src>` no HTML, sem duplicatas por rota. Home: 13 arquivos, 704.597 bytes brutos / 224.514 bytes gzip calculado; estoque: 14 arquivos, 750.062 / 239.045 bytes; ficha canônica do Civic da fixture: 14 arquivos, 732.124 / 233.451 bytes. Gzip calculado com `node:zlib`, não transferência medida na Vercel. Não inclui módulos carregados após interação nem o payload RSC inline. É uma referência para futura redução do cliente, sem alegar melhora do bundle neste lote.
- Não foram medidos Lighthouse, LCP, INP ou CLS no preview. Os testes locais usam fotos substitutas e não medem rede/qualidade do Storage. A validação de performance em produção permanece pendente de preview e dados representativos.

## Validação

- Node 24.21.0, como a versão principal do CI. Node 20 do ambiente não consegue instanciar o SDK atual do Supabase sem WebSocket nativo; o teste existente de Storage passou ao usar Node 24, sem mudança de dependência ou secrets.
- `npm test`: 1.175 testes passaram, incluindo regressões de facetas, 304, imagem alterada, HEAD e remoção de cabeçalhos privados.
- `npm run lint`: passou.
- `npm run build`: passou com PostgreSQL isolado em `127.0.0.1:55432/garagem_e2e`, sem notificações externas. Schema e seed foram aplicados exclusivamente nesse banco recém-criado.
- `npm run test:e2e -- e2e/public-journeys.spec.ts --grep "paginação diária|404 real|card, ficha|busca tolerante|cookies na primeira"`: 20 testes passaram em 320, 390, 430 e 1440 px. Cobertura: paginação diária e por preço, total/continuidade, filtro de acessórios sem resultados, ausência de cidade, ficha vendida sem preço, aliases/404, favoritos/WhatsApp, busca e cookies. Não foi executada a suíte e2e completa do chat/admin.
- `git diff --check`: passou.

## Tarefas prontas para issue/PR futuro

- Medir no preview home, estoque e ficha com fotos reais, Lighthouse mobile e mediana de várias rodadas; registrar LCP/CLS e tamanho transferido de JS/imagens. Fazer investigação de INP com interações e dados de campo.
- Medir tráfego e repetição de ids em favoritos antes de adicionar cache público de dados em `/api/veiculos`, com invalidação por tag e testes de venda/remoção.
- Com volume representativo, executar `EXPLAIN (ANALYZE, BUFFERS)` das consultas de estoque/busca e relacionados; só então propor índices/migração em PR próprio.
- Medir tamanho do conjunto diário e das entradas do Data Cache; se necessário, cachear a ordenação de ids e carregar fotos/histórico apenas do lote solicitado.
- Medir repetição e custo de `/api/catalog-jpg` e do health check; avaliar limites/cache sem interromper o crawler da Meta nem mascarar indisponibilidade.

Referência consultada: [Next.js — unstable_cache](https://nextjs.org/docs/app/api-reference/functions/unstable_cache). Também foi consultado o [changelog do Supabase](https://supabase.com/changelog.md); não há mudança de API/schema/credenciais do Supabase neste lote.
