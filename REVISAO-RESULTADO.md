    at async Models.generateContentStream (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:268812:16)
    at async file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:313348:19
    at async file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:289294:23
    at async retryWithBackoff (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:309615:23)
    at async GeminiChat.makeApiCallAndProcessStream (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:334930:28)
    at async GeminiChat.streamWithRetries (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:334610:29)
    at async Turn.run (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:335668:24)
    at async GeminiClient.processTurn (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:349660:22)
    at async GeminiClient.sendMessageStream (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:349757:14)
Attempt 2 failed. Retrying with backoff... Error: exception TypeError: fetch failed sending request
    at file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:267791:13
    at async Models.generateContentStream (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:268812:16)
    at async file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:313348:19
    at async file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:289294:23
    at async retryWithBackoff (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:309615:23)
    at async GeminiChat.makeApiCallAndProcessStream (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:334930:28)
    at async GeminiChat.streamWithRetries (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:334610:29)
    at async Turn.run (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:335668:24)
    at async GeminiClient.processTurn (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:349660:22)
    at async GeminiClient.sendMessageStream (file:///home/lucas/.npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-RCB6BI5H.js:349757:14)
### Revisão do commit `aa8025e` (`reserva/sobre-foto`)

**O que está correto:**
- **Validação (`npm run check`):** passou integralmente (2021 testes, `eslint`, `check-footguns` e `tsc --noEmit`).
- **Performance e matemática do recorte (`FounderSection.tsx`):** `measureImageAlphaBounds` amostra em `96×171` px (~16 mil pixels) apenas **uma vez** por URL (`useEffect` com `[portrait]`, sem loop e sem listener de `resize`, já que o estilo final usa `%`). Para a foto atual (`720×1280` com sujeito em `x: 49..100%`, `y: 50..100%`), `computeFounderCutoutStyle` entrega ~6% de respiro acima da cabeça, encosta a borda direita sem fenda e leva o tronco até a base do `4:5`.
- **Same-origin em `/fotos/v1`:** a foto atual do Storage é reescrita por `publicPhotoSrc` para `/fotos/v1/original/...` e servida em same-origin por `src/app/fotos/[...path]/route.ts` sem redirect externo — o canvas **não** sofre *taint* nesse caminho.
- **Regras visuais, SSR, erro e foto comum:** sem `bg-black` nem faixa preta (usa `bg-ink` + gradiente `ink/asphalt` + brilho radial da marca); coluna desktop equilibrada (`lg:items-center` + `aspect-[4/5]` reservado no SSR sem CLS); falha de carga continua ocultando o bloco via listener `error` no `useEffect` com `src` relativo preservado para `e2e/fotos-publicas.spec.ts`; foto retangular opaca retorna `null` e fica bem enquadrada em `object-cover object-[50%_20%]`.
- **`/vender` ("Como funciona"):** `border border-white/10` removida nos passos, preservando `bg-ink`, textos, ordem e espaçamento.
- **Testes (`src/lib/public-contact-pages.test.ts`):** cobrem SSR `4:5`, ausência de `bg-black`, foto opaca, recorte assimétrico e ausência de borda em `/vender` sem fragilidade.

### Ajustes obrigatórios

1. **Eliminar o salto visível do retrato antes da hidratação/medição em `src/components/site/FounderSection.tsx`:**
   - Hoje o `<Image loading="eager">` renderiza no SSR já visível (`opacity: 1`) com `object-cover object-[50%_20%]`. Para o recorte real (`720×1280` no canto inferior direito), o primeiro *paint* exibe a faixa vertical `y: 6%..76%` da imagem (cabeça pequena a ~63% da altura do quadro, metade esquerda vazia e peito cortado) e, assim que o `useEffect`/`load` mede o alpha, o retrato salta bruscamente (~65% para a esquerda e ~1,65× de escala).
   - **Como ajustar:** manter o contêiner `aspect-[4/5]` com o fundo da marca visível no SSR (zero CLS), mas esconder apenas o `<img>` até a medição concluir (ou cair no fallback) e revelar com *fade* curto (`opacity-100 transition-opacity duration-150`). Use `[@media(scripting:enabled)]:opacity-0` antes de medir (para não esconder se JS estiver desativado e sem usar `display: none`/`visibility: hidden`, preservando `getByRole("img")` em `e2e/fotos-publicas.spec.ts`).
2. **Garantir same-origin (ou fallback sem *taint* de CORS) quando a foto do fundador vier de upload novo em R2/Vercel Blob (`src/lib/public-photo-url.ts` / `src/app/fotos/[...path]/route.ts` ou `FounderSection.tsx`):**
   - Em `SiteContentEditor.tsx`, o painel orienta enviar a foto *"com o fundo já removido"* via `uploadImageDirect`, que grava URL cross-origin em `PHOTO_R2_ORIGIN` ou `PHOTO_BLOB_ORIGIN` (ambas aceitas por `parseFounderPhotoUrl`, mas mantidas como `https://...` por `publicPhotoSrc`). Nesse caso, `getImageData` lança `SecurityError` (canvas *tainted*) e cai em `object-cover object-[50%_20%]`, que desenquadra recortes assimétricos (e também expõe origem externa em `img[src]` se o admin reenviar a foto). Verifique que um recorte enviado em Blob/R2 continue mensurável sem quebrar o carregamento da `<img>` caso falte header CORS no bucket (ex.: servindo pela rota same-origin `/fotos/v1/...` quando aplicável, ou documentando/tratando o fallback).

**Arquivos inspecionados na revisão:**
- `src/components/site/FounderSection.tsx`
- `src/app/(site)/vender/page.tsx`
- `src/lib/public-contact-pages.test.ts`
- `e2e/fotos-publicas.spec.ts`

VEREDITO: AJUSTAR
VERTEX_USAGE model=gemini-4-carbon pedido=gemini-4-carbon:high input=100638 cached=576494 output=3345 thoughts=19408 total=699885 reqs=21

### Nota do coordenador sobre o ajuste 2
Mantenha o PR pequeno: NÃO amplie o proxy /fotos nem crie rotas novas. Basta garantir que, se o canvas falhar (SecurityError/taint, decode, timeout), a imagem é revelada mesmo assim (nunca fica invisível) com o enquadramento padrão, sem erro no console que quebre algo; deixe um comentário curto no código explicando o fallback. Ajuste 1 (sem salto: esconder só o <img> até medir, fade curto, visível sem JS) é obrigatório.
