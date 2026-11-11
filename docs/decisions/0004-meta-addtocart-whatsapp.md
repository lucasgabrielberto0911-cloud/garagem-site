# ADR 0004: Campanha Meta otimizada em AddToCart no WhatsApp

**Status:** aceito

## Contexto

O site não tem carrinho e-commerce; o funil real é WhatsApp. A Meta precisa de sinal consistente com o catálogo (`vehicle_id` = CUID).

## Decisão

No clique do WhatsApp da ficha, disparar **AddToCart** e **Lead**, ambos com `content_ids` e `content_type=vehicle`. Manter otimização da campanha em **AddToCart** (trocar no meio zera aprendizado).

Detalhes: `docs/ops.md`.

## Consequências

- PRs não removem esses eventos “por LGPD” sem substituto combinado.
- Alterações no id do veículo exigem alinhar feed CSV e pixel.
