# ADR 0005: Fotos novas no Cloudflare R2

**Status:** aceito (migração gradual)

## Contexto

Egress do Supabase Storage estourou; downloads para servir e testar fotos têm custo e risco operacional.

## Decisão

Novas fotos públicas vão para R2 (`r2-photos.ts`, env `R2_*`). Legado permanece no Supabase até backfill/migração planejada.

## Consequências

- Agentes não baixam bucket de produção para “validar”.
- Testes usam fixture local.
- PRs de foto devem considerar ambas as origens até fim da migração.
