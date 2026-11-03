# Egress das fotos do estoque — 02/11/2026

## Resumo

Alerta informado pelo Lucas: 11,13 GB de egress em cache para franquia de 5,5 GB, com prazo em 05/11. O código já tinha proxy de fotos com cache longo, mas havia saídas diretas no catálogo para JPG/PNG e buscas do servidor nos testes que escapavam de `page.route`. Este PR fecha essas saídas e limita a cópia pública ampla a 1280 px, sem ativar `/_next/image` nem alterar produção, `.env` ou depoimentos.

Não há como desfazer os bytes já contabilizados. A redução vale para tráfego futuro após publicação; não garante que o alerta ou a restrição em 05/11 desapareçam.

## Evidências

Consulta somente de leitura ao Explorer de logs do Supabase, sem acessar objetos ou listar buckets. A janela retornada cobre **02/11/2026 01:24:50–23:50:43**, timestamps do serviço. Soma dos `response.headers.content_length`, não medição do painel nem total do ciclo:

| Origem observada | Requisições GET | Bytes declarados |
| --- | ---: | ---: |
| Storage, todas as origens | 10.800 | 381.470.650 |
| Agente `node` | 10.591 | 359.837.510 |
| Três miniaturas usadas em `e2e/public-samples.json`, HIT, agente `node` | 8.943 | 234.410.786 |
| Uma foto original, Chrome headless, referência `http://127.0.0.1:3362/` | 55 | 9.130.880 |

Os três nomes dominantes terminam em `48cdfb54e167-card.webp`, `95b4ab3a6d8d-card.webp` e `65920e219250-card.webp`. Coincidem exatamente com os fixtures do Civic, Duster e HR-V. Isso e o referer local indicam tráfego de testes. **`node` também é usado pelo proxy público em produção: não se pode atribuir os 359,8 MB inteiros ao CI nem afirmar que bots causaram os 11,13 GB.** O conteúdo das fotos não foi baixado durante a investigação.

Consulta de agregação reproduzível no Explorer:

```sql
select
  log_attributes['request.path'] as filepath,
  log_attributes['request.headers.referer'] as referer,
  log_attributes['request.headers.user_agent'] as user_agent,
  log_attributes['response.headers.cf_cache_status'] as cache_status,
  count() as requests,
  sum(toFloat64OrZero(log_attributes['response.headers.content_length'])) as bytes
from logs
where source = 'edge_logs'
  and log_attributes['request.path'] like '%storage/v1/%'
  and log_attributes['request.method'] = 'GET'
group by filepath, referer, user_agent, cache_status
order by requests desc
limit 20;
```

## Caminho das fotos e correções

- `next.config.mjs:21`: `unoptimized: true`; sem loader personalizado. `remotePatterns` autoriza o host, não cria cache ou transformação. O registro em `docs/ops.md` informa cota de Image Optimization esgotada e erro 402. Foi mantido desligado.
- `src/lib/supabase.ts:10`: cliente administrativo de Storage para servidor. Não é ele que decide o `src` do navegador. Uploads e banco continuam com URLs do Storage; a apresentação pública converte essas URLs.
- `src/lib/stock-query.ts:117`: gera os recortes e os descritores de `srcset`; capas usam miniaturas gravadas de 480×360, galeria oferece 800 e 1280. Os WebP já tinham teto de 1280 no upload, mas nomes antigos não garantem tamanho e o fallback podia escolher o original.
- `src/lib/public-photo-url.ts:50` e `src/components/VehicleImage.tsx:49`: nova conversão específica de veículos usa `/fotos/v1/1280-contain-q78/...` para a foto ampla. Cards e recortes existentes preservam suas dimensões. A conversão genérica usada pelos depoimentos permanece igual.
- `src/lib/public-photo-http.ts:57`: cópia ampla é WebP, limitada nos dois eixos, sem ampliação e sem metadados, com fonte limitada a 15 MB e 40 milhões de pixels. Falhas não retornam original nem recebem cache. Não usa transformações faturadas de `/_next/image` e não grava objetos no Supabase.
- `src/lib/public-photo-http.ts:40`: cache explícito da CDN Vercel; cópias versionadas por um ano e cards por 30 dias sem `immutable`, pois o backfill pode sobrescrevê-los. O proxy já tinha cache de um ano; o header específico explicita a política, não demonstra ganho incremental por si só.
- `src/lib/catalog-feed.ts:338`: JPG/PNG deste Storage deixam de ser URLs diretas no CSV da Meta. A rota `/api/catalog-jpg/...` agora limita inclusive JPEG antigo a 1280 px, qualidade 80, e preserva CDN de um dia. Hosts externos não foram migrados. Não foi encontrado outro feed de catálogo Google no repositório; o Google recebe sitemap e JSON-LD.
- `src/app/sitemap.ts:95`, `src/lib/seo.ts:383` e `src/app/(vehicle)/estoque/[id]/page.tsx:110`: sitemap, JSON-LD e Open Graph passam a anunciar a cópia ampla reduzida. Preloads e `srcset` de veículos usam a mesma conversão; não foi criado preload de original.
- `src/lib/e2e-photo-fixture.ts:5`: com `E2E_TEST=1`, só banco local `ci`/`garagem_e2e` permite a fixture. O servidor público, os downloads de galeria e o zoom usam a cópia local. Configuração E2E com banco externo falha antes de buscar Storage. Isso cobre `APIRequestContext`, que não obedece a `page.route`.
- `/api/foto-jpg/...` também passa a limitar JPEG antigo a 1280 px, preservando qualidade 90. Era outra rota pública capaz de devolver JPEG grande sem redimensionar. O master privado no E2E recebe a mesma proteção de fixture.
- Zoom continua limitado a 2200 px e 500 KB, requisitado por gesto; masters privados e downloads autenticados do admin preservam o comportamento normal.

## Estimativa de redução

| Mudança | Redução esperada | Condição |
| --- | --- | --- |
| Fotos nas rotas E2E protegidas | 100% dos downloads reais dessas rotas | Execução com `E2E_TEST=1` e banco local dedicado |
| Repetições de uma imagem servida pela Vercel | 95–99% dos bytes de origem desse fluxo | CDN com 95–99% de HIT, fonte igual, sem variantes extras |
| Catálogo antigo JPG/PNG que antes ia direto ao Storage | De uma busca por crawler para uma busca por MISS da CDN | Cache de um dia, por região/URL; aquecimento inicial ainda custa |
| Tamanho entregue ao visitante/crawler | Depende da foto; teto de 1280 px | Isso reduz bytes ao visitante; a fonte ainda é baixada em cada MISS |

Exemplo de cache: 1.000 leituras da mesma fonte de 200 KB consomem 200 MB sem cache intermediário. Com 10 MISS, consomem 2 MB no Supabase: 99% de redução nesse fluxo. Não multiplicar esse percentual pelos 11,13 GB do alerta: parte do site já tinha proxy, os testes não têm atribuição mensal completa e URLs diretas antigas continuam públicas.

Os 234,4 MB das três miniaturas equivaleriam a cerca de 7 GB em 30 dias **se** a amostra diária se repetisse e **se** fossem integralmente de testes. É cenário de dimensão, não promessa de economia. Não há estimativa global defensável sem comparar um ciclo e os HIT/MISS reais após publicação.

## Prioridades e tarefas para o coordenador

| Prioridade | Impacto × esforço | Tarefa pronta |
| --- | --- | --- |
| P0 | Alto × baixo | Revisar e integrar este PR; publicar antes do prazo informado pelo Supabase |
| P0 | Alto × baixo | Conferir no painel Supabase a medida necessária para evitar a restrição de 05/11; bytes acumulados não são revertidos pelo código |
| P1 | Alto × baixo | Comparar logs de Storage antes/depois, isolando os três fixtures, referers locais e GETs dos crawlers |
| P1 | Alto × baixo | Em preview solicitado, verificar `x-vercel-cache: MISS` e depois `HIT` com fixture ou bucket isolado; nunca medir baixando foto de produção |
| P2 | Médio × médio | Se persistir acesso direto às URLs antigas, levantar os consumidores e propor migração de origem; qualquer mudança de bucket exige tarefa própria |

## Validação e limites

Testes unitários incluem fontes sintéticas em paisagem/retrato, JPEG/WebP de até 1280 px, rejeição de fonte inválida/grande, política de cache e bloqueio de banco externo em E2E. Os testes de navegador cobrem 320, 390, 430 e 1440 px com fixture local. Resultados finais: `npm test` com **1.704 aprovados**, `npm run lint` e `npm run build` aprovados; `npx tsc --noEmit --project tsconfig.test.json` aprovado. `npx playwright test e2e/fotos-publicas.spec.ts e2e/seo-fichas.spec.ts` teve **16 aprovados em 52,1 s**, nas quatro larguras. Build e E2E usaram Postgres descartável local na porta 5549, sem credenciais de Storage válidas.

Não houve download de imagens de produção, escrita no banco/Storage de produção, alteração de variáveis, deploy, merge ou mudança nos depoimentos. A taxa real de HIT da CDN e Lighthouse antes/depois em preview não foram medidas nesta tarefa local; nenhum ganho real de LCP foi inventado.

Fontes: [Supabase — egress e consulta de logs](https://supabase.com/docs/guides/storage/serving/bandwidth), [Vercel — prioridade de Cache-Control](https://vercel.com/docs/caching/cache-control-headers), [Vercel — cache da CDN](https://vercel.com/docs/caching/cdn-cache). O cache do próprio Supabase continua contando como egress; cache HIT na Vercel evita uma nova leitura da origem. Changelog consultado: a mudança de TLS de 10/11 não explica este tráfego.
