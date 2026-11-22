# AJUSTES no PR #551 (/vendidos v3) — revisão de design do Opus + pedido do Lucas ("bem bonito, bem otimizado, bem top")
Mesmo worktree/branch (reserva/vendidos-v3). NÃO fazer push, merge, force nem promoção; o coordenador empurra. NÃO usar WebSearch/WebFetch. NÃO mexer em .env/chaves. NÃO commitar TAREFA*.md/REVISAO*.md.

## Dados novos (o coordenador já trocou no worktree; não regenerar)
- Lucas: só entra post cuja foto mostra o CLIENTE JUNTO do carro. Reverificado com visão: `src/data/vendidos-insta.json` agora tem N itens (veja o arquivo; ajuste os testes para o N real, sem número fixo antigo 282).
- Cada item: `{ id, date, brand, model, src (600x750), srcSmall (360x450), lqip (data URI WebP 16x20, ~100–200 B) }`. Recorte refeito para não cortar os títulos das artes.
- `public/vendidos-insta/`: `*.webp` (600x750, q74) e `*-360.webp` (360x450). Commitar tudo, incluindo remoções.
- `scripts/vendidos-insta-build.py`, `scripts/vendidos-insta-classificar.py`, `scripts/vendidos-insta-verificar.py`, `scripts/vendidos-insta-recorte-texto.py`: referência, commitar.

## Desempenho (obrigatório)
1. `<img>` com `srcSet="{srcSmall} 360w, {src} 600w"` e `sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 46vw"` (ajuste ao contêiner real: 4 col no desktop, 2 no celular). `width=600 height=750`.
2. LQIP: o `lqip` do item como fundo borrado da caixa da foto (camada atrás do `<img>`, `background-size: cover`, `filter: blur(12px)` + `scale(1.1)` com `overflow-hidden`), e fade-in suave do `<img>` ao carregar — com o MESMO cuidado do PR #550: a foto nunca pode ficar invisível (imagem já completa antes da hidratação → visível; JS desligado → visível; onLoad que não dispara → salvaguarda); `prefers-reduced-motion` sem transição. Nada de fundo preto chapado.
3. 1ª foto `fetchPriority="high"` + `loading="eager"`; até a 4ª eager; resto `lazy` + `decoding="async"`. Itens que entram pelo "Ver mais" lazy.

## Design (revisão do Opus)
- OBRIGATÓRIA (já resolvida nos dados): títulos das artes não cortados — confira nos prints.
- Selo "VENDIDO": `aria-hidden="true"` (o alt já informa); no celular um pouco menor (`px-2 py-0.5 text-[10px]`), mantendo legível; no desktop como está.
- Cabeçalho: `text-balance` no parágrafo da linha curta (evitar "Garagem" sozinha na 2ª linha).
- Polimento extra "bem top" sem exageros: sombra suave/realce vermelho no hover do desktop, cantos e espaçamentos consistentes, tipografia marca/modelo bem alinhada; nada de borda em volta do card; vermelho principal, nunca dourado; Sora/Inter.
- Manter: 4 por linha no desktop, 2 no celular, "Ver mais" grande, CTA WhatsApp verde #25D366 com texto escuro no fim, sem data/preço/contador/link/"Simular"/"loja digital".

## Testes
- Unit: manifesto com N (do arquivo), cada `src`/`srcSmall` existe, `lqip` começa com `data:image/webp;base64,` e < 400 chars; rótulos.
- e2e `e2e/vendidos-galeria.spec.ts`: além do que já tem, a 1ª foto tem fetchpriority high, a 10ª é lazy, o `<img>` tem srcset com 360w e 600w, a foto fica visível (opacity 1) após carregar, selo com aria-hidden.
- `npm run check` e o e2e de /vendidos passando. Commit: "Vendidos: fotos com cliente, LQIP, srcset e polimento (revisão de design)". Resumo final.
