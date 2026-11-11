# Área: páginas institucionais (`(site)`)

## Escopo

Grupo `src/app/(site)/` — layout compartilhado com header, footer, chat deferido:

| Rota | Uso |
| --- | --- |
| `/sobre`, `/contato`, `/faq` | Institucional + `site-content` |
| `/vender` | Quero vender meu carro |
| `/pedido` | Pedido de veículo (lead) |
| `/favoritos` | Lista local (cliente) |
| `/cidades`, `/seminovos/*` | SEO regional (complementa [`seo.md`](seo.md)) |
| `/guias`, `/guia/[slug]` | Conteúdo editorial |
| `/privacidade` | Legal |
| `/links` | Hub bio (editável no admin site) |

## Comportamento

1. **`revalidate`** alinhado às páginas (em geral 3600; conteúdo do admin invalida `site-settings`).
2. Marca **Garagem**; WhatsApp e Instagram oficiais (ver `README.md`).
3. Pedido/vender: não prometer laudo, preço ou prazo inventado.

## Cache

- Textos editáveis: `site-settings.ts`, `site-content.ts` — tag `site-settings`.
- Actions: `src/app/admin/site/actions.ts`, `(site)/vender/actions.ts`.

## Testes

- `e2e/links.spec.ts`, `pedido-compacto.spec.ts`, `site-melhorias.spec.ts`
- Regional: `performance-seo-regional.spec.ts`

## Erros comuns de IA

- Criar nova página pública sem metadata em `seo.ts`.
- Expor dados internos em FAQ ou guias.

Coordenação de área: costuma ser `seo` ou `home` conforme o foco; confira `gh pr list`.
