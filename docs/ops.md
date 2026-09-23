# Operação — Vercel Hobby

## Região das Functions

`vercel.json` fixa `"regions": ["gru1"]` (São Paulo), a mesma região do banco no Supabase (`sa-east-1`). Antes as Functions rodavam em `iad1` (EUA) e cada consulta do painel/site atravessava o continente. Se o banco mudar de região, mude aqui junto.

## Functions Storage e retenção de deploys

No plano Hobby a Vercel conta o armazenamento dos bundles de Functions **por deploy retido** (GB-mês, por região). Bundles grandes (`sharp` no upload) pesam mais em cada revisão antiga que o projeto guarda.

A retenção de deploys no Hobby é limitada (hoje, no máximo 30 dias). Os 10 deploys de produção mais recentes e qualquer deploy com alias ativo não são apagados. Não é preciso subir de plano: em **Project → Settings → Security → Deployment Retention** dá para encurtar o prazo dos previews. Menos deploys retidos = menos Functions Storage.

Para achar Functions grandes: **Deploy → Resources → Functions**. Rotas leves (`/api/chat`, `/api/estoque`) não devem puxar o pipeline de upload.

## Image Optimization

A cota Hobby de `/_next/image` já esgotou neste projeto (`unoptimized: true` em `next.config.mjs`). Cards usam o WebP 480×300 gerado no upload (`thumbnailUrl`). Não religar o otimizador da Vercel sem upgrade de plano.
