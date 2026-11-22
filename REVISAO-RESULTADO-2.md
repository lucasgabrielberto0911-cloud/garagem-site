Attempt 1 failed. Retrying with backoff... Error: exception TypeError: fetch failed sending request
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
### Re-revisão do commit `96de112` (`reserva/sobre-foto`)

**O que foi validado e está correto:**
- **`npm run check`:** passou integralmente (2022 testes, `eslint`, `check-footguns` e `tsc --noEmit`).
- **Ajustes do commit `96de112` (revisão anterior + nota do coordenador):**
  - **Sem salto antes da medição:** o contêiner `aspect-[4/5]` com superfície da marca permanece reservado no SSR (zero CLS), enquanto o `<img>` inicia com `[@media(scripting:enabled)]:opacity-0` (gerando `@media(scripting:enabled)` válido no Tailwind 3, sem `display: none`/`visibility: hidden`, preservando `getByRole("img")` no E2E) e revela já posicionado com `opacity-100` e `transition-opacity duration-150`.
  - **Nunca fica invisível / fallback silencioso:** sem JS a mídia `scripting:enabled` não ativa e a foto aparece com `opacity: 1`; em `SecurityError` (canvas *tainted* em R2/Blob) ou erro de decodificação, `measureImageAlphaBounds` retorna `null` silenciosamente (com comentário explicativo) e `updateFraming` revela com o enquadramento padrão; em atraso/ausência de `load`, `FRAMING_FALLBACK_TIMEOUT_MS` (2000 ms) revela a foto e é limpo corretamente em `load`, `error` e unmount; em falha real da imagem, o bloco continua sendo removido.
  - **Escopo mantido pequeno:** nenhuma rota nova nem ampliação do proxy `/fotos`, e `/vender` ("Como funciona") segue sem bordas.

### Ajuste obrigatório (regressão em `next dev`)

1. **Crash de renderização do `<Image fill>` em `NODE_ENV=development` quando `activeCutoutStyle` é aplicado (`src/components/site/FounderSection.tsx`):**
   - Ao medir um recorte assimétrico transparente (como a foto real do fundador), `computeFounderCutoutStyle` devolve `width` e `height` diferentes de `"100%"` (ex.: `165.90%` / `235.94%`) e `FounderSection` passa esse objeto direto em `style` do `<Image fill>`.
   - No Next.js 16, `getImgProps` valida em `NODE_ENV === "development"` (`npm run dev`) que imagens com `fill` não podem ter `style.width` nem `style.height` diferentes de `100%`, lançando erro fatal durante o re-render pós-`load` (`Image with src ... has both "fill" and "style.width" properties. Images with "fill" always use width 100% - it cannot be modified.`), o que derruba a página `/sobre` inteira em ambiente de desenvolvimento (passou despercebido nos prints e E2E porque `next start` roda em `production` e o placeholder do E2E é opaco).
   - **Como corrigir:** aplicar `style={activeCutoutStyle ?? undefined}` em um wrapper posicionado (`absolute inset-0`) ao redor do `<Image fill>` dentro do quadro `aspect-[4/5] overflow-hidden`, mantendo o `<Image fill>` sem `style` customizado (preenchendo sempre 100% do wrapper), e cobrir esse caso em `src/lib/public-contact-pages.test.ts`.

**Arquivos revisados:**
- `src/components/site/FounderSection.tsx`
- `src/app/(site)/vender/page.tsx`
- `src/lib/public-contact-pages.test.ts`
- `e2e/fotos-publicas.spec.ts`

VEREDITO: AJUSTAR
VERTEX_USAGE model=gemini-4-carbon pedido=gemini-4-carbon:high input=121785 cached=522963 output=4001 thoughts=13882 total=662631 reqs=16
