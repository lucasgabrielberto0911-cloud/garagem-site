# SEO das fichas de veículo

## Resumo

Títulos e descrições identificam marca, modelo, versão, ano, preço publicável e “seminovo ES”. Vendidos mantêm identificação e estado, sem preço, com `noindex, follow` (conforme AGENTS.md), canonical próprio, fora do sitemap e com sugestões de veículos similares disponíveis.

Open Graph e Twitter usam a primeira foto cadastrada e alt com identificação completa. A galeria acrescenta versão e cor ao alt, preservando ordem, arquivos e carregamento das fotos. Breadcrumbs visíveis no desktop e JSON-LD usam a mesma sequência: início, estoque, marca, modelo e veículo. Links para marca/modelo e cidades atendidas aparecem também no celular; são regiões de atendimento, nunca a cidade do veículo.

## Evidências

- `src/app/(vehicle)/estoque/[id]/page.tsx`: metadata, canonical, compartilhamento, alt, breadcrumbs e navegação; cache preservado (3600 s).
- `src/lib/vehicle-seo.ts` e `src/lib/format.ts`: identificação preservada; versões longas são abreviadas antes do sufixo para respeitar o teto de 60 caracteres sem perder a marca nem o contexto regional.
- `src/lib/seo.ts`: `Car`/`Motorcycle` são subtipos de [Vehicle](https://schema.org/Vehicle). Oferta usa BRL, condição usada, disponibilidade, URL canônica e vendedor identificado. Vendido não contém preço, moeda nem validade. Remove-se o prazo de 30 dias que era calculado sem uma validade comercial cadastrada.
- O [Schema.org Offer](https://schema.org/Offer) permite descrever disponibilidade sem preço. Isso não garante elegibilidade para [resultados enriquecidos de produto do Google](https://developers.google.com/search/docs/appearance/structured-data/product-snippet), que exigem campos adicionais, incluindo preço na oferta. Não se inventa preço para atender ao validador.
- `src/app/sitemap.ts`: preservado com disponíveis públicos (`PUBLIC_SITEMAP_VEHICLE_WHERE`) e exclusão de `historical`.
- `e2e/seo-fichas.spec.ts`: valida HTML real, schemas, canonical sem UTM, foto principal, alt, links navegáveis e vendido com `noindex, follow` e sem preço, em 320, 390, 430 e 1440 px.

## Medição local

Lighthouse mobile, Chromium headless, build de produção, Postgres local com fixtures e a mesma ficha Honda Civic 2015. Uma rodada por estado; variação de CPU/rede impede atribuir pequenas diferenças à mudança. Baseline `d4b2b17`; medição posterior feita antes de integrar o PR paralelo de auditoria.

| Métrica | Antes | Depois |
| --- | ---: | ---: |
| Performance | 86 | 85 |
| SEO | 100 | 100 |
| LCP | 3,73 s | 3,70 s |
| CLS | 0,0024 | 0,0024 |
| TBT | 202 ms | 252,5 ms |

LCP permanece acima de 2,5 s. INP de campo não foi medido; TBT não substitui INP. Correções de LCP pertencem ao trabalho paralelo `reserva/correcoes-auditoria`.

## Validação e prioridades

- Node 24, como no CI; banco `garagem_e2e` exclusivamente local. Sem alterações em `.env`, segredos ou banco de produção.
- `npm test`, `npm run lint`, `npm run build` e E2E de SEO/ficha vendida/jornadas públicas.
- Alta prioridade, fora deste PR: concluir e medir as correções de LCP do trabalho paralelo.
- Após publicação: acompanhar indexação de vendidos e resultados enriquecidos no Search Console; nenhuma marcação garante indexação.
