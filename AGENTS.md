# AGENTS.md: regras para agentes de IA neste repo

Este arquivo vale para **todos** os agentes: Codex (GPT), Claude Code e Cursor (cloud agents).
O `CLAUDE.md` importa este arquivo. As regras do Cursor em `.cursor/rules/` só reforçam o que está aqui.
Escreva código, comentários de PR e textos do site em **português do Brasil**.

## Projeto
- Site da loja de seminovos **Garagem** (Linhares/ES): https://www.suagaragem.net
- Stack: Next.js 16 (App Router) + React 19, Tailwind 3, Prisma 6 + Postgres no Supabase (`sa-east-1`), Vercel Hobby com Functions em `gru1` (ver `vercel.json` e `docs/ops.md`).
- Pastas: `src/app/(catalog)` (home e estoque), `src/app/(vehicle)/estoque/[id]` (ficha), `src/app/admin` (painel), `src/app/api`, `src/components/site`, `src/components/admin`, `src/lib` (regras de negócio, com testes `*.test.ts`), `e2e/` (Playwright), `prisma/`.

## Comandos (iguais ao CI em `.github/workflows/ci.yml`)
```bash
npm ci
npx prisma generate
npm test          # tsx --test src/lib/*.test.ts
npm run lint
npm run build     # prisma generate && next build
npm run test:e2e  # Playwright (precisa do banco local com seed: npm run e2e:seed)
```
O PR só sai de rascunho com `test`, `lint` e `build` passando. Mexeu em tela pública? Rode ou ajuste o e2e correspondente.

### Economia de tokens (vale para todos os agentes)
- Leia só o trecho necessário: `rg -n "termo" caminho` para achar e `sed -n 'início,fimp' arquivo` para ler. Não use `cat` em arquivo inteiro nem vários `cat` numa chamada só.
- Filtre a saída de build, lint e teste: por exemplo, `npm run build 2>&1 | tail -40` ou `npm test 2>&1 | grep -E -A5 "fail|Error" | head -80`. Só abra o log inteiro se o trecho não bastar.
- Não leia `package-lock.json`, `*.zip`, `branding/`, `.next/` nem `node_modules/`.

## Divisão de trabalho e coordenação
| Agente | Papel | Pode escrever código? |
|---|---|---|
| Grok Bot | Coordena, divide tarefas, revisa e confere deploy | Sim |
| Codex (GPT) | Pesquisa profunda e diagnóstico | **Não**: só escreve relatórios em `docs/pesquisas/AAAA-MM-DD-tema.md` |
| Claude Code (Sonnet) | Aplica mudanças em PR rascunho e cuida de vídeos complexos | Sim |
| Cursor (cloud agent) | Segundo programador, trabalha em paralelo | Sim |

Regras:
1. **1 tarefa = 1 branch = 1 PR rascunho.** Não junte assuntos diferentes no mesmo PR.
2. **Prefixo de branch por agente:** `claude/<tema>`, `codex/<tema>` (só relatórios), `cursor/<tema>`. Use temas curtos em kebab-case, por exemplo `claude/ficha-jsonld-veiculo`.
3. **Sempre abrir como Draft PR.** O título fica em português e o corpo diz o que mudou, por quê, como foi validado (comandos e telas) e o que falta.
4. **Merge fica com o Grok Bot (coordenador).** Em 2026-10-10 o Lucas autorizou: o Grok Bot revisa CI e preview e faz o squash-merge. Os outros agentes **sempre** abrem Draft PR e **nunca** fazem merge, force-push em `main`, rebase de branch alheia ou fecham PR de outro agente.
5. **Não trabalhar na mesma área ao mesmo tempo.** Áreas: `ficha`, `estoque`, `home`, `admin`, `chat`, `seo`, `api/meta`, `infra`. Antes de começar, confira os PRs abertos (`gh pr list`). Se já houver um PR aberto na mesma área, avise o coordenador em vez de começar.
6. Quadro de tarefas: Issues do GitHub com labels `agente:claude`, `agente:codex`, `agente:cursor` e `area:<área>`. Pegue só issues com a sua label.
7. **Produção é intocável:** não rode `prisma db push`, migrações, seeds ou scripts (`scripts/*.ts`) contra o banco real. Também não altere variáveis de ambiente na Vercel. Teste com banco local/isolado (igual ao CI).
8. Nunca commitar `.env*`, fotos originais de anúncio, chaves ou tokens.

## Marca (obrigatório em qualquer texto, tela, arte ou vídeo)
- O nome da marca é **Garagem**, não "Sua Garagem". `suagaragem.net` é só o domínio. Não crie novas ocorrências visíveis de "Sua Garagem". As ocorrências antigas (metadados, aviso de consentimento, assistente) só mudam em PR próprio, combinado com o Lucas.
- Paleta: preto `#0D0D0F` (`asphalt`), vermelho `#F80000` e off-white `#F7F5F2` (`cream`).
  - No Tailwind de hoje, o token `brand` é `#E8181C`. Use os tokens (`bg-asphalt`, `text-cream`, `bg-brand`) e não espalhe hex no código. Trocar o token para `#F80000` é PR próprio.
- O gradiente `#E8181C → #FF8A00 → #FFC72C` (`bg-brand-gradient`) entra **só como detalhe** (filete, sublinhado, ícone), nunca em fundo grande ou botão principal.
- Fonte de títulos: Barlow Condensed (`font-display`).

## Regras de negócio do site
- **Carro vendido não mostra preço** em lugar nenhum: ficha, card, JSON-LD, mensagem de WhatsApp e assistente. Isso já está implementado (ver `src/app/(vehicle)/estoque/[id]/page.tsx` e o PR #227). A ficha vendida usa `noindex, follow` e título com "(vendido)".
- **A cidade do veículo aparece só no admin** (PR #219). Ela não entra em card, ficha, comparação, filtros públicos, API pública nem assistente. A região atendida e `/cidades` continuam.
- **Cards do estoque:** use chips pequenos e discretos (ano, km, câmbio etc.). Nada de chip grande competindo com foto e preço. Teste em 320, 390, 430 e 1440 px.
- O botão de WhatsApp é o principal CTA. Não remova os eventos `AddToCart` e `Lead` (com `content_ids` = id do veículo e `content_type=vehicle`): a campanha da Meta otimiza em AddToCart (ver `docs/ops.md`).

## Cache / ISR (Vercel Hobby: cada regravação custa)
- Páginas públicas: `revalidate = 600` em home, `/estoque` e ficha. `sitemap.ts` usa `revalidate = 300`.
- Dados públicos usam `unstable_cache` com a tag `VEHICLES_PUBLIC_CACHE_TAG` (`src/lib/vehicles.ts`). Site e conteúdo usam a tag `site-settings` (3600 s). Os dados do admin usam tags próprias (`src/lib/admin-stats.ts`, `admin-revalidate.ts`).
- Mudou um veículo? Chame **`revalidatePublicStock()`** (`src/lib/public-stock-revalidate.ts`), que revalida a tag, home, `/estoque`, sitemap e **só o slug daquela ficha**.
  - **Nunca** use `revalidatePath("/estoque/[id]", "page")`: isso regrava todas as fichas.
  - `updateTag` só pode ser usado em Server Actions.
- O feed da Meta (`/api/meta/catalog.csv`) fica no cache da CDN (`s-maxage`) e não entra no ISR.
- Não crie rota nova com `dynamic = "force-dynamic"` ou sem cache sem justificar no PR.

## SEO e performance
- Fichas: metadata via App Router, canonical pelo slug (`src/lib/vehicle-slug.ts`), JSON-LD de veículo/oferta sem preço quando vendido.
- Meça antes e depois (Lighthouse ou Chrome DevTools MCP no preview da Vercel) quando mexer em tela pública. Metas: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 no celular.
- Fotos públicas saem por `/api/fotos/...` com cache longo. Não troque para `next/image` sem medir (ver `docs/ops.md`, seção Image Optimization).

## Relatórios do Codex (`docs/pesquisas/`)
Formato: `AAAA-MM-DD-tema.md`, com resumo, evidências (arquivo:linha, URL, medição), prioridades (impacto × esforço) e uma lista de tarefas prontas para virar issue/PR.
O relatório não altera nenhum arquivo fora de `docs/pesquisas/`.
