# Handoff — Melhorias de Contraste e Usabilidade (Ficha & UI Global)

## 1. Objetivo da tarefa
Melhorar a legibilidade, o contraste e a usabilidade do site da **Garagem** (`https://www.suagaragem.net`) para clientes menos familiarizados com tecnologia e usando celulares de tela pequena (`320px–390px`) vindos de anúncios pagos, **sem alterar o padrão visual atual** (paleta `asphalt`/`cream`/`brand`, fontes `Sora` e `Inter`, grade 2 colunas no `/estoque`).

## 2. O que já foi feito
- **Branch anterior (`claude/qol-catalogo-a11y`, PR #464):**
  - Enxugado o JS inicial de `/estoque` (incluindo *error boundary* leve em `src/app/(catalog)/error.tsx` e `src/app/(vehicle)/error.tsx` sem importar `@/components/site/ui`).
  - Commit `2a6048d` enviado para `origin/claude/qol-catalogo-a11y`; todos os checks do CI (`unit`, `migrations`, `e2e (1..4)`, `changes`, `check`) passaram. Falta apenas o merge/saída de Draft pelo Lucas ou Grok Bot.
- **Branch atual (`claude/ficha-contraste-usabilidade`, derivada de `main` `f1a9acb`):**
  - **Ano do veículo em destaque e alto contraste:** exibido badge de ano (`formatVehicleYearRange` / `yearLabel`) junto ao título no topo da ficha desktop (`src/app/(vehicle)/estoque/[id]/page.tsx`) e mobile (`VehicleMobileDossier.tsx`).
  - **Quadros de especificações (`VehicleKeyFacts.tsx` e fichas técnica desktop/mobile):** bordas reforçadas (`border-white/20`), rótulos `dt` mais legíveis (`text-cream/75`), unidade `" km"` exibida no KM, `whitespace-nowrap` no ano para não quebrar `2019/2020` em `320px`, e `[overflow-wrap:break-word]` no lugar de `anywhere`.
  - **Ações rápidas (`VehicleQuickActions.tsx`):** aparência explícita de botão clicável (`border-white/20`, `min-h-11`) com micro-ícone do WhatsApp (`#25D366`).
  - **Barra fixa mobile (`VehicleMobileBar.tsx`) e folga inferior (`VehicleMobileDossier.tsx`):** mantido `"Chamar no WhatsApp"` completo mesmo abaixo de `400px` e adicionado `pb-6` na ficha mobile.
  - **Voltar sobre a foto (`StockBackLink.tsx`):** variante `overlay` transformada em pílula `min-h-11` (`← Voltar` / `← Estoque`).
  - **Contraste e posição global (`DeferredSiteChat.tsx` e `CookieConsent.tsx`):**
    - Botão `"Ajuda para escolher"` com `bg-brand-dark` (`#C91418`) e `text-cream` (contraste >= 4,5:1) e fonte mobile `text-[13px] sm:text-sm`.
    - Banner de cookies reposicionado no desktop em listagens (`/`, `/estoque`, `/favoritos`, `/marca/*`, `/modelo/*`, etc.) para `lg:!left-auto lg:!right-24 lg:!bottom-6` (não cobre mais os filtros laterais de `/estoque`), mantendo a posição original na ficha (`/estoque/[id]`) e fonte mais legível (`text-xs sm:text-[13px]`) com botões `min-h-11`.

## 3. O que falta (em passos)
1. Revisar o `git diff` completo desta branch (`claude/ficha-contraste-usabilidade` vs `main`) garantindo conformidade com `AGENTS.md`:
   - Veículo vendido (`sold`) nunca exibe preço.
   - `locationCity` nunca aparece em telas públicas.
   - Marca **Garagem** (sem novas ocorrências de "Sua Garagem") e eventos `AddToCart` / `Lead` intactos.
2. Rodar a suíte completa na VM Linux (`garagem-dev`):
   - `npm run check` (`test` + `lint` + `scripts/check-footguns.sh` + `tsc`)
   - `npm run build`
   - `npm run test:e2e` (especialmente `e2e/ficha-v2.spec.ts`, `e2e/site-melhorias.spec.ts`, `e2e/lote-site.spec.ts` e `e2e/seo-modelos-funil.spec.ts`)
3. Abrir Draft PR da branch `claude/ficha-contraste-usabilidade` contra `main` (e opcionalmente incluir `[preview]` só no commit final quando quiser validar no preview da Vercel).
4. **Follow-up após o merge do PR #464:** ajustar `SiteHeader.tsx` (evitar corte de `"Ajuda"` em `360px`) e `src/app/globals.css` (remover glare `::after` sobre `.ficha-price` e reforçar contraste de `.listing-card-chip`), que foram deixados de fora desta branch para não conflitar com o PR #464.

## 4. Arquivos principais mexidos
- `src/app/(vehicle)/estoque/[id]/page.tsx`
- `src/components/site/VehicleMobileDossier.tsx`
- `src/components/site/VehicleKeyFacts.tsx`
- `src/components/site/VehicleQuickActions.tsx`
- `src/components/site/VehicleMobileBar.tsx`
- `src/components/site/StockBackLink.tsx`
- `src/components/site/DeferredSiteChat.tsx`
- `src/components/CookieConsent.tsx`

## 5. Comandos para rodar e testar
```bash
npx tsc --noEmit
npm run lint
npm run check
npm run build
npm run test:e2e:one -- e2e/ficha-v2.spec.ts e2e/site-melhorias.spec.ts e2e/lote-site.spec.ts
```

## 6. Decisões tomadas
- **Mantida a ficha técnica mobile completa (`sheetSpecs`):** `src/lib/ficha-cta.test.ts:266-271` exige explicitamente que `Ano`, `km`, `Câmbio`, `Combustível` e `Cor` apareçam na seção `"Ficha técnica"` além do topo. Não removemos esses itens de `sheetSpecs` para preservar o contrato dos testes.
- **Zero edição em `SiteHeader.tsx` e `globals.css` nesta branch:** evita conflito de merge com o PR #464 enquanto ele ainda está aberto. Por isso o reposicionamento do `CookieConsent` no desktop foi feito com classes utilitárias condicionais por `usePathname()`.

## 7. Problemas conhecidos
- A revisão final pelo agente `verificador` e a execução completa de `npm run check` / `npm run build` / `test:e2e` ainda não foram concluídas nesta máquina Windows (foi pausado para handoff).
- No Windows local, `OfflineLeadFlush.tsx` e `scripts/check-footguns.sh` têm checagens dependentes de LF/bash que passam normalmente no Linux (`garagem-dev` e CI), e `next build` local não tinha `DATABASE_URL` no `.env` para prerender de `sitemap.xml`.
