# Anti-padrões — o que IAs costumam errar

Lista rápida para revisar **antes** de commitar. Cada item aponta o padrão correto (detalhes em [`AGENTS.md`](../AGENTS.md)).

## Cache e Vercel

| ❌ Evitar | ✅ Fazer |
| --- | --- |
| `revalidatePath("/estoque/[id]", "page")` após editar um carro | `revalidatePublicStock()` em `public-stock-revalidate.ts` |
| Nova rota pública `force-dynamic` sem motivo | `revalidate` + cache; justificar no PR se precisar dinâmico |
| Esquecer invalidação após Server Action que muda estoque | Chamar `revalidatePublicStock(vehicleId, { previous? })` |
| `updateTag` fora de Server Action | `updateTag` só em `"use server"`; em Route Handler use `revalidateTag` conforme o helper |
| Ligar `next/image` otimizado sem medir cota | Manter `unoptimized: true`; ver `docs/ops.md` |

## Negócio e copy

| ❌ Evitar | ✅ Fazer |
| --- | --- |
| Preço em card/ficha/WhatsApp/JSON-LD/chat para **vendido** | Ocultar preço em todos os canais (regra global) |
| Mostrar **cidade do veículo** no público, filtros, API, chat | Cidade só no admin; região da loja em `/cidades` |
| Texto "Sua Garagem" novo visível | Marca **Garagem**; domínio `suagaragem.net` é só URL |
| "Consignado" para o cliente | Termo interno; não expor |
| Inventar km, laudo, opcional, preço | Só dados do banco; IA não fabrica ficha |
| Remover `AddToCart`/`Lead` do WhatsApp | Manter eventos com `content_ids` = CUID |

## Marca e UI

| ❌ Evitar | ✅ Fazer |
| --- | --- |
| Hex solto (`#E8181C`) espalhado | Tokens Tailwind: `asphalt`, `cream`, `brand` |
| `bg-brand-gradient` em botão ou hero inteiro | Gradiente só como detalhe (filete, ícone) |
| Barlow Condensed no site | Sora (`font-display`) + Inter (`font-body`) |
| Chips grandes no card competindo com preço/foto | Chips pequenos e discretos; testar 320–1440 px |
| Componente só de `components/admin` em página pública | Mover estilo para `site` ou duplicar padrão público |

## Fotos e produção

| ❌ Evitar | ✅ Fazer |
| --- | --- |
| `curl`/`wget` de foto em `suagaragem.net` ou Supabase Storage | Fixture local + `page.route` no Playwright |
| Script que lista/baixa bucket de produção | Banco e bucket de teste local |
| Commitar foto original de anúncio | Só fixtures versionadas quando necessário |
| Teste de galeria/Storage com `R2_*` do ambiente | Isolar (apagar) as quatro variáveis no teste, como em `gallery-preview.test.ts` |

## Banco, deploy e Git

| ❌ Evitar | ✅ Fazer |
| --- | --- |
| `prisma db push` / seed / scripts contra produção | Postgres local ou CI (`E2E_TEST=1`) |
| Alterar env na Vercel pelo agente | Lucas/ops humano |
| Merge na `main` por agente | Draft PR; Grok Bot mergeia |
| Dois PRs na mesma **área** ao mesmo tempo | `gh pr list` antes de começar |
| Push sem `npm test` + `lint` + `build` | Mesmo pipeline do CI |
| Label `preview` em todo commit | Só no teste final (`[preview]` ou label GitHub) |

## SEO

| ❌ Evitar | ✅ Fazer |
| --- | --- |
| Canonical diferente do slug em `vehicle-slug.ts` | Canonical = URL canônica do veículo |
| Offer com preço em JSON-LD vendido | Sem oferta monetária quando vendido |
| Bloquear `/estoque` no `robots.txt` | Bloquear só `/admin` e `/api` |
| `buildPageMetadata({ noIndex: true })` em `src/app/not-found.tsx` | Só `title` e `description`. O App Router já emite `noindex` no 404; o segundo meta quebra o e2e `seo-modelos-funil` |

## Onde achar o certo

```bash
rg -n "revalidatePublicStock" src
rg -n "noindex" src/app/\(vehicle\)
rg -n "VEHICLES_PUBLIC_CACHE_TAG" src/lib
```

Mapa completo: [`ONDE-ESTA.md`](ONDE-ESTA.md).
