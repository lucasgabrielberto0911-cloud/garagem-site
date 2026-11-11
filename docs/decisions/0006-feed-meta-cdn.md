# ADR 0006: Feed Meta dinâmico com cache CDN

**Status:** aceito

## Contexto

O Commerce Manager consome CSV em intervalo curto. O feed precisa refletir estoque disponível sem depender do ISR das fichas.

## Decisão

Rota `/api/meta/catalog.csv` com `dynamic = "force-dynamic"` e resposta cacheada na CDN (`s-maxage` em `catalog-feed-http.ts`). **Não** usar `revalidatePublicStock` para o CSV.

## Consequências

- Atualização de estoque no banco aparece após TTL da CDN, não após invalidação ISR.
- PRs não devem “simplificar” removendo `force-dynamic` sem entender o cache HTTP.
