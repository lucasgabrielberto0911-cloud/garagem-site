# SEO por estoque, cidades, funil e orçamento mobile

## Resumo

Itens 5, 7, 10, 11 e 12 de `site-claude.md`. Landings por marca/modelo geradas exclusivamente de anúncios públicos cadastrados; vendidos entram só no histórico, sem preço. Sem anúncio disponível nem histórico, a página usa `noindex, follow`. Cache público de 600 s e sitemap de 300 s.

Cidades reaproveitam estoque real (até seis anúncios), FAQPage e BreadcrumbList existentes e recebem links para outras cidades e modelos. Nenhuma consulta nova seleciona a cidade física do veículo.

Cinco guias: documentos, cautelar, transferência, recall e checklist da visita. Cada guia liga fontes oficiais, estoque real e WhatsApp. Fontes: [Detran/ES](https://detran.es.gov.br/transferencia-de-propriedade-ou-domicilio) e [Senatran](https://www.gov.br/pt-br/servicos/realizar-consulta-sobre-recall-de-veiculos). Sem taxas, prazos ou garantias inventadas.

## Evidências e medição

- `src/lib/stock-landing-data.ts`: projeção sem preço, cidade física ou dados internos; exclui registros `historical` de vendas internas.
- `src/components/site/StockLanding.tsx`: disponíveis usam o card público existente; histórico de vendidos contém apenas identificação, ano, estado e link.
- `src/lib/admin-funnel.ts`: eventos reais da semana e conversas registradas no admin, agrupados por origem e veículo. Alerta para disponíveis com pelo menos dez acessos e nenhum clique.
- `src/app/api/funil/route.ts`: origem fechada, validação de id público, limite de corpo e rate limit. O cliente só coleta com consentimento. Não armazena URLs, UTMs livres, telefone, IP ou id de sessão no evento.
- Eventos usam o diário existente `AdminAudit`, com ações exclusivas `site:visita`/`site:whatsapp` e autores `site:<origem>`. Histórico administrativo filtra esse namespace. Não exige migração nem operação no banco real.
- Cache do funil: 60 s, tag `admin-data`. Contagens são independentes: acessos/cliques não são pessoas únicas e não comprovam atribuição de venda. Leads e etapas comerciais vêm das conversas de compra do WhatsApp da semana; não há preenchimento retroativo de eventos.
- `DeferredPwa` carrega PwaRegister após load e ocioso. SiteExtras carrega InstallPrompt, BootSplash/BrandSplash e ScrollProgress no agendamento ocioso existente; interação não antecipa mais o carregamento desses extras.

### Bundle inicial por rota

Medição via CDP `Network.loadingFinished.encodedDataLength` para scripts concluídos até `load`, cache desligado, viewport 390 × 844, mediana de três navegações. Baseline: commit `3954863`, compilado separadamente com o mesmo banco local e fixtures; sem alterar dependências do projeto. Valores incluem overhead HTTP da transferência local e não representam tamanho de JS descomprimido nem total após ociosidade.

| Rota | Antes (bytes) | Depois (bytes) | Diferença |
|---|---:|---:|---:|
| `/` | 192.837 | 192.872 | +35 |
| `/estoque` | 207.995 | 208.030 | +35 |
| `/seminovos/linhares` | 185.436 | 185.460 | +24 |

O novo coletor compensa a pequena economia dos imports adiados: bundle inicial praticamente estável, sem alegar redução. Orçamento automatizado: até **220 KiB transferidos até load** por rota. O teste bloqueia terceiros para não depender da disponibilidade de serviços externos; conteúdo e APIs continuam no app/banco local.

### Lighthouse mobile local

Lighthouse, Chromium headless, configuração mobile padrão, `/estoque`, build de produção e cache frio. Rodadas únicas, sujeitas a variação da máquina e da rede; não são Core Web Vitals de campo.

| Métrica | Antes | Depois | Meta |
|---|---:|---:|---:|
| LCP | 3,503 s | 3,519 s | ≤ 2,5 s |
| CLS | 0,0095 | 0,0058 | ≤ 0,1 |
| TBT | 33,5 ms | 44 ms | diagnóstico de laboratório |
| Performance | 91 | 90 | diagnóstico de laboratório |

LCP continua acima da meta. INP não é comprovado pelo Lighthouse; meta de campo permanece ≤ 200 ms. O resultado não justifica trocar fotos ou pipeline de imagens neste lote. Medição Lighthouse feita antes do último ajuste do coletor (diferença de 156 bytes no bundle); tabela de bundle acima usa o build final.

## Validação e prioridades

- Testes existentes, lint e build com Node 24, mesmo runtime do CI. Node 20 local falha em um teste preexistente do SDK de Storage; Node 24 passa sem mudar fotos.
- Suíte E2E completa local: 215 aprovados, 48 ignorados por dependerem de fixtures específicas de auditoria, um timeout no teste existente de centralização da ficha. Repetição isolada desse teste: aprovada em 1,3 s. Os 20 testes novos passaram.
- E2E cobre 320, 390, 430 e 1440 px: landings, histórico sem preço, noindex vazio, canonical/sitemap, cidades e schemas, cinco guias, evento real até painel autenticado e orçamento de JS.
- Fotos em testes de navegação usam fixture offline já adotada no repo; dados de negócio são fixtures exclusivamente do Postgres local `ci`. Nenhuma escrita no banco real.

Tarefas seguintes, prontas para issue/PR:

1. Alta prioridade: medir LCP no preview/produção sem concorrência e investigar o elemento LCP se permanecer acima de 2,5 s. Preservar o pipeline de fotos até haver evidência e autorização para outro lote.
2. Média prioridade: acompanhar INP de campo e a taxa de consentimento; evitar interpretar ausência de eventos como ausência de interesse.
3. Baixa prioridade: se o volume de eventos crescer, migrar o namespace do diário para agregados diários próprios, com retenção definida e migração revisada.
