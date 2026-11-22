# REVISÃO DE DESIGN do PR #551 (/vendidos v3, branch reserva/vendidos-v3) — você é o revisor de design (o autor foi o gemini-4-neon)
NÃO edite código, NÃO faça commit, push, merge nem promoção. NÃO mexa em .env/chaves. Só analise e devolva o parecer.

Contexto: o dono (Lucas) reprovou a versão anterior: "ficou só um texto seco" e as fotos tinham "um monte de borda" (faixas laterais borradas). Ele pediu "fazer um negócio bom". Leia TAREFA.md neste diretório (pedido completo) e o código: `src/app/(site)/vendidos/page.tsx`, `src/components/site/InstaDeliveriesGrid.tsx`, `src/lib/vendidos-insta.ts`, CSS relacionado.

Prints da página construída deste branch (abra as imagens):
- ~/prints-v3/v3-mobile.png (390x844 @2x, topo) e ~/prints-v3/v3-mobile-full.png (página inteira)
- ~/prints-v3/v3-desktop.png (1440x900, topo) e ~/prints-v3/v3-desktop-full.png (página inteira)

Avalie como diretor de arte exigente, para um público simples (cliente de revenda de seminovos no interior do ES, maioria no celular):
1. A página está atraente e "viva", não seca? Hierarquia do cabeçalho, ritmo da grade, carimbo VENDIDO (legível, de bom gosto, não poluído), tipografia marca/modelo, espaçamentos (sem espaço desperdiçado), hover/animação sutis.
2. Fotos cheias 4:5 sem faixas/bordas/barras pretas; recorte bom.
3. Regras do site: vermelho como cor principal, NUNCA dourado/amarelo; Sora (títulos) e Inter (texto); sem cards com borda; 4 por linha no desktop e 2 no celular; botão "Ver mais" grande; CTA de WhatsApp verde #25D366 com texto escuro; sem data, preço, contador, link do Instagram, "Simular", "loja digital".
4. Acessibilidade básica: contraste, alt, foco visível, toque ≥44px, prefers-reduced-motion.

Saída: lista objetiva de mudanças (cada uma concreta: arquivo, classe/valor sugerido) em ordem de impacto, separando OBRIGATÓRIAS de OPCIONAIS. Termine com uma linha exatamente "VEREDITO: OK" (se não houver obrigatória) ou "VEREDITO: AJUSTES — <resumo>".
