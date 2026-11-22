### Resumo da revisão (`origin/main...HEAD` — commit `5c6c58d8`)

- **`npm run check`:** passou integralmente (2019/2019 testes unitários, `eslint`, `check-footguns` e `tsc` principal + testes; merge limpo com `origin/main`).
- **1. Proxy `/fotos/[...path]` + `public-photo-http.ts` + `site-content.ts`:**
  - Em `src/app/fotos/[...path]/route.ts` e `src/lib/public-photo-http.ts`, o proxy está protegido contra SSRF: o `upstream` continua sendo montado exclusivamente por `publicPhotoUpstream(parts)` com `validPublicPhotoKey`, `redirect: "error"`, sem cookies/autorização, liberando apenas `v1/original/<chave>` quando `content.founderPhotoUrl === upstream`. Fotos legadas de veículos e todas as variantes derivadas seguem retornando `410` (`Cache-Control: no-store`), e a foto permitida recebe `public, max-age=31536000, s-maxage=31536000, immutable` + `Vercel-CDN-Cache-Control` + `X-Content-Type-Options: nosniff`.
  - **Problema encontrado em `src/lib/site-content.ts` (`parseFounderPhotoUrl`, linhas 50–58):** o uso de `isPublicPhotoSource(value)` delega a validação de R2 para `isR2StorageHost` (`src/lib/r2-photos.ts:99`), que aceita **qualquer** bucket público de terceiros `https://pub-*.r2.dev/...` em vez de restringir ao R2 do projeto (`PHOTO_R2_ORIGIN` = `https://pub-92a1bcb633c0472bbd89ca0f450e5935.r2.dev` e `publicPhotoR2Origin()`, padrão já adotado em `isAllowedLqipUrl` em `src/lib/photo-lqip-cache.ts:42`). Além disso, o ramo `FOUNDER_PHOTO_HOST` aceita caminhos/queries arbitrários em `vesmqhyxautgtvgccweo.supabase.co` e trunca com `.slice(0, 500)` após validar.
- **2. `FounderSection`:** SSR limpo (sem acesso a `window`/`document` no render), sem layout shift quando a foto carrega, e colapsa tanto o `<Image>` quanto a coluna `bg-black` via `onError` + `useEffect` (`complete && naturalWidth === 0` para falha pré-hidratação). Ponto de atenção ligado ao item 1: se uma URL malformada de `.supabase.co/storage/` passar pelo banco, `publicPhotoSrc` devolve `/branding/placeholder-car.png` (200 OK), exibindo silhueta de carro como retrato do fundador em vez de colapsar.
- **3. `TrustBadges`:** verificado em todo o repositório (`rg TrustBadges`) — é usado **exclusivamente** em `src/app/(site)/sobre/page.tsx:317` (dentro da coluna direita de ~756px ao lado do índice fixo; home, estoque e ficha não usam). O grid `sm:grid-cols-2` sem borda elimina a quebra feia de 4 linhas no desktop sem afetar nenhuma outra página.
- **4. Regras visuais e de conteúdo (`/sobre` e `/contato`):** vermelho principal (`brand` / `brand-gradient` sem amarelo/dourado), botão principal de WhatsApp em `#25D366` com texto escuro (`text-asphalt`), zero cards com borda, remoção do retângulo escuro 16:9 mantendo *"Procedência. Clareza. Resultado."*, passo 01 sem menção a filtros inexistentes, frases padrão *"Atendemos Linhares, Aracruz e Grande Vitória"* e *"Combinamos o atendimento pelo WhatsApp"*, zero *"loja digital"* ou parcelas/simulação, depoimentos intocados, e todas as informações de `/contato` preservadas (WhatsApp, telefone, atendimento, horário, Instagram, e-mail e razão social/CNPJ) sem duplicações.
- **5. `SiteFooter`:** 14 links de navegação preservados em 2 colunas no desktop (mais serviços, cidades, Instagram, contato, privacidade e dúvidas), WhatsApp da coluna Contato agora com ícone alinhado, barra fixa mobile (`MobileBottomNav`) intacta e alvos de toque ≥ 44px (`min-h-11` / `min-h-[44px]` / `min-h-[48px]`).
- **6. Testes:** bons testes comportamentais em `public-photo.test.ts` e `public-contact-pages.test.ts`; falta cobrir a rejeição de buckets R2 de terceiros em `parseFounderPhotoUrl`.

### Ajustes obrigatórios

1. **`src/lib/site-content.ts` (`parseFounderPhotoUrl`):** restringir origens R2 aceitas apenas a `PHOTO_R2_ORIGIN` (`https://pub-92a1bcb633c0472bbd89ca0f450e5935.r2.dev`) e `publicPhotoR2Origin()` com `validPublicPhotoKey` (como em `src/lib/photo-lqip-cache.ts`), restringir `FOUNDER_PHOTO_HOST` ao prefixo `/storage/v1/object/public/veiculos/` com `validPublicPhotoKey` (sem credenciais, porta, query ou hash) e rejeitar URLs acima do tamanho máximo antes da validação em vez de truncar com `.slice(...)`.
2. **`src/components/site/FounderSection.tsx`:** tratar `portrait === "/branding/placeholder-car.png"` (quando `photoUrl` original não for esse caminho) como `null`, garantindo que URLs legadas inválidas colapsem a coluna da foto em vez de renderizar o placeholder de veículo.
3. **`src/lib/public-contact-pages.test.ts`:** adicionar asserções garantindo que `parseFounderPhotoUrl` rejeita buckets R2 alheios (ex.: `https://pub-outro-bucket.r2.dev/foto.webp` → `null`) e caminhos inválidos no host do Supabase.

### Arquivos revisados
- `src/app/fotos/[...path]/route.ts`
- `src/lib/public-photo-http.ts`
- `src/lib/site-content.ts`
- `src/components/site/FounderSection.tsx`
- `src/components/site/TrustBadges.tsx`
- `src/app/(site)/sobre/page.tsx`
- `src/app/(site)/contato/page.tsx`
- `src/components/site/SiteFooter.tsx`
- `src/lib/public-photo.test.ts`
- `src/lib/public-contact-pages.test.ts`

VEREDITO: AJUSTAR
VERTEX_USAGE model=gemini-4-carbon pedido=gemini-4-carbon:high input=155603 cached=1551696 output=4145 thoughts=29895 total=1741339 reqs=20

### Ajuste visual adicional (coordenador, print local 390px)
4. **/contato no celular:** a primeira tela usa `.clear-fab-screen` (min-height ≈ 100dvh). Como o card do WhatsApp ficou mais curto, sobra um vão vazio de ~250px entre o card (telefone) e "Outros canais e atendimento" — é excesso de espaço, regra proibida. Corrija sem reintroduzir repetições: por exemplo, trazer o bloco de horário/atendimento de volta para dentro da primeira tela como uma linha compacta abaixo do telefone, OU deixar "Outros canais" começar logo após o card no celular (sem min-height forçando o vão), mantendo a compensação da bottom nav. Verifique em 390x844 que não fica vão vazio.
