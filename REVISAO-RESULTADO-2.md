proved.
Error executing tool run_shell_command: Tool execution denied by policy.
### Re-revisão (`80bce20` — `reserva/carro-vendido`)

**Validação executada:**
- `npm run check` passou integralmente (`2031` testes unitários, `eslint`, `check-footguns` e `tsc`).
- `next build --webpack` e `npx playwright test e2e/link-antigo-vendido.spec.ts --project=mobile-390 --project=desktop` passaram (`10/10` testes verdes no banco local `garagem_e2e`).

**O que ficou bem resolvido no commit `80bce20`:**
- **Segurança contra reflexão arbitrária:** `extractModel` migrou para allowlist fechada; `<marca>-lixo`, `<marca>-ofensa` e `<marca>-<placa>` devolvem `label: null` sem refletir termos no `<title>`, meta description, página ou WhatsApp.
- **Paridade mobile (`390px`):** `selectSimilarVehiclesForSoldSlug` corta 3 → 2 disponíveis e `SoldVehicleNotFound` mantém 1 coluna quando há apenas 1 item (`[&_.listing-card-item]:!col-span-1`), sem tocar em `globals.css`.
- **Reaproveitamento e enxugamento:** marcas centralizadas em `src/lib/format.ts`, regras de moto/carroceria compartilhadas via `src/lib/vehicle-display.ts` (`catalog-feed.ts` e `chat-stock.ts`), mensagem de WhatsApp usando `formatCustomerVehicleWhatsAppText(..., { sold: true })` de `src/lib/site.ts`, `metadata` morto removido de `not-found.tsx` e payload reduzido para `take: 16` com LQIP alinhado em 16.
- **E2E e não-regressão:** cobertos viewport `390x844`, slugs sujos com marca válida, ficha de vendido no banco (`200`) e `retired-listings` (`301`/`308` para `/estoque`).

---

### Ajuste obrigatório (regressão introduzida em `80bce20`)

1. **Bug na construção de `KNOWN_CAR_MODELS` corrompe modelos populares (`Onix`, `Gol`, `Polo`, `Fox`, `Fit`, `City`, `Mobi`, `Uno`, `Ka`) e injeta lixo na allowlist (`src/lib/sold-slug-fallback.ts`, linhas 103–107):**
   - Na linha 105:
     `part.replace(/\b|\[[- ]\]\?|\?/g, "").replace(/[^a-z0-9 ]/gi, "")`
     Em literal RegExp JS, `/\b/` casa *word boundary* (vazio), **não** a sequência literal `\b` (`\\b`) presente na string `rule.pattern.source` de `CATALOG_BODY_RULES` (além de `\[[- ]\]\?` casar apenas 1 caractere entre colchetes e falhar em `[- ]?` de `\bs[- ]?10\b`). Em seguida, `[^a-z0-9 ]` remove `\` e **deixa a letra `b` colada no modelo**.
   - **Efeito comprovado:**
     - Slugs reais dos carros mais vendidos da loja devolvem `label: null`: `chevrolet-onix-...`, `volkswagen-gol-...`, `volkswagen-polo-...`, `volkswagen-fox-...`, `honda-fit-...`, `honda-city-...`, `fiat-mobi-...`, `fiat-uno-...`, `ford-ka-...` (29 ocorrências reais em `src/data/vendidos-insta.json` quebram hoje).
     - Tokens corrompidos entraram em `KNOWN_CAR_MODELS` (`bmobib`, `bonixb`, `bgolb`, `bfoxb`, `bupb`, `bkab`, `bunob`, `bfitb`, `bpolob`, `cityb`, `bswb`, `bsuvb`, `bsw4b`, `bl200b`, `bhb20b`), fazendo p.ex. `parseSoldVehicleSlug("fiat-bmobib-2022")` retornar `"Fiat Bmobib 2022"` e burlando `GENERIC_BODY_TOKENS` (`sw`/`suv` viraram `bswb`/`bsuvb`).
   - **Lacunas reais no mesmo mapa (conferidas contra os 275 vendidos de `src/data/vendidos-insta.json`):** incluir também modelos recorrentes do histórico da loja que ficaram de fora — especialmente **`kwid`** (5x no histórico), `stepway`, `asx` (`"ASX"` em `SPECIAL_SINGLE_MODELS`, junto com `i30: "i30"`), `crossfox`, `"polo sedan"` e `"s 10": "S10"` em `COMPOUND_MODELS`, além de `cbx` e `crf` nas siglas de moto.
   - **Como corrigir e blindar em teste:** evitar *regex-scraping* frágil de `.pattern.source` (exportando lista limpa de tokens de modelos em `vehicle-display.ts` ou corrigindo para `/\\b|\[\^?[^\]]*\]\??|\?/g`) e adicionar teste em `src/lib/sold-slug-fallback.test.ts` cobrindo `Onix`, `Gol`, `Polo`, `Fox`, `Fit`, `City`, `Mobi`, `Uno`, `Ka`, `Kwid` e `S-10` (e/ou os itens de `src/data/vendidos-insta.json`) e garantindo que `fiat-bmobib-2022` / `volkswagen-bgolb-2020` retornem `label: null`.

### Arquivos revisados
- `src/app/(vehicle)/estoque/[id]/page.tsx`
- `src/app/(vehicle)/estoque/[id]/not-found.tsx`
- `src/components/site/SoldVehicleNotFound.tsx`
- `src/lib/sold-slug-fallback.ts`
- `src/lib/sold-slug-fallback.test.ts`
- `src/lib/format.ts`
- `src/lib/vehicle-display.ts`
- `src/lib/catalog-feed.ts`
- `src/lib/chat-stock.ts`
- `src/lib/vehicles.ts`
- `e2e/link-antigo-vendido.spec.ts`

VEREDITO: AJUSTAR
VE