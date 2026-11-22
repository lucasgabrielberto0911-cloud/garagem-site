# AJUSTES 2 no PR #551 — re-revisão do Opus (REVISAO-DESIGN-2.md tem o parecer completo)
Mesmo worktree/branch. NÃO fazer push, merge, force nem promoção. NÃO usar WebSearch/WebFetch. NÃO mexer em .env/chaves. NÃO commitar TAREFA*.md/REVISAO*.md.

## Dados (o coordenador já trocou; não regenerar)
- `src/data/vendidos-insta.json`: agora 275 itens (saíram 5 com moldura/colagem/telefone antigo; EcoSport DfibFMqCdOd recortado de novo). Campo novo `art: boolean` = a foto já tem arte de texto/carimbo da loja. `public/vendidos-insta/` atualizado (commitar remoções/alterações). Scripts em `scripts/` atualizados.

## Código (obrigatórias do Opus)
1. LCP: em `InstaDeliveriesGrid.tsx`, NÃO aplicar o estado de fade/`loading` (opacity 0) nas fotos eager (as 4 primeiras, que já vêm pintadas pelo servidor): return no início do efeito para elas. Fade + LQIP só nas lazy. Mantém as salvaguardas existentes.
2. Marca: `formatInstaAlt` → "{Marca Modelo} entregue a cliente da Garagem" / "Veículo entregue a cliente da Garagem" (sem "Sua Garagem"); metadata description da página: "Fotos de clientes com os veículos vendidos pela Garagem." Ajustar testes.
## Opcionais aprovados
3. Selo "VENDIDO": NÃO renderizar quando `item.art === true` (a arte já tem carimbo/título; evita tapar texto e duplicar). Nas demais, como está.
4. Subtítulo: "Clientes que já saíram da Garagem de carro ou moto novos" (há motos).
5. Payload: não passar `date` (nem campos não usados) para o client component (map no `page.tsx`).
6. `sizes`: trocar 23vw por 22vw na faixa 1024–1439 (ou o valor equivalente usado), mantendo coerência.
7. "Ver mais": após carregar, anunciar com `aria-live="polite"` (ex. região sr-only "Mais 24 entregas carregadas") ou levar o foco ao primeiro item novo (`tabIndex={-1}`).
Não mexer em tokens globais/Tailwind config.

## Testes
Unit e e2e atualizados (N do arquivo, alt sem "Sua", selo ausente quando art, 1ª foto sem data-photo-state=loading após hidratação). `npm run check` + e2e de /vendidos passando. Commit: "Vendidos: ajustes da revisão de design (LCP, selo, textos)". Resumo final.
