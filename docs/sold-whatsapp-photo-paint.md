# WhatsApp de vendidos e primeiro paint das fotos

Comparativo de 10/10/2026 contra a main `cdcbb0d`. Um PR em rascunho, sem merge.

## Comportamento

Uma ficha vendida nunca acrescenta preço às mensagens de interesse, similares,
simulação, troca, vídeo ou visita. O texto convida a ver opções parecidas no
estoque. Cabeçalho, barra, contato flutuante e cabeçalho do assistente seguem a
mesma regra. Disponíveis e reservados mantêm os textos anteriores.

A home e o estoque usam o mesmo layout compartilhado, em um grupo sem o
`loading.tsx` global. Assim, as fotos chegam visíveis no HTML inicial; não ficam
em um bloco oculto esperando o runtime do React revelar a página. As outras
páginas mantêm seu carregamento anterior. A grade inicial do estoque é a própria
lista interativa, em vez de uma grade provisória substituída na hidratação.
A observação dos filtros na URL fica em um Suspense separado, sem envolver as
fotos. As imagens prioritárias recebem preload responsivo e decodificação
síncrona; as demais continuam com carregamento e decodificação adiados.

URLs, visual, fontes, textos da home, qualidade, variantes e dimensões das fotos
permanecem iguais. A home e o estoque continuam estáticos, com `revalidate = 600`.
Nenhuma configuração de ISR, CDN, Storage ou otimização paga de imagens mudou.

## Lighthouse mobile antes e depois

Lighthouse 13.5.0, Chromium, build de produção local, viewport 412 × 823, DPR
1,75, CPU 4× e perfil Slow 4G. Três execuções por página em cada versão, com
perfil novo do navegador a cada medição. Tabela com medianas, sem escolher o
melhor resultado. Não houve builds ou testes concorrentes durante as medições.

O conjunto local é o mesmo antes e depois: Civic, Duster e HR-V, com as fotos
públicas reais, servidas pela rota existente `/fotos`. A ficha medida foi
`/estoque/honda-civic-lxr-2-0-flexone-2015-cmubrhzwf0000l304geveibp1`.

### Perfil padrão do Lighthouse (simulação)

| Página | LCP antes | LCP depois | CLS antes (mediana) | CLS depois (mediana) |
| --- | ---: | ---: | ---: | ---: |
| Home | 4,18 s | 3,77 s | 0,00236 | 0,00236 |
| Estoque | 4,30 s | 3,95 s | 0,00236 | 0,00236 |
| Ficha | 3,64 s | 3,63 s | 0,00236 | 0 |

### Rede e CPU efetivamente limitadas pelo DevTools

Segunda série para medir diretamente a espera entre o fim do download e a
pintura. Essa decomposição usa os tempos observados no trace, não a simulação
do Lighthouse; os dois modos não devem ser misturados.

| Página | LCP antes | LCP depois | Espera para pintar antes | Espera para pintar depois |
| --- | ---: | ---: | ---: | ---: |
| Home | 2,92 s | 2,41 s | 859 ms | 376 ms |
| Estoque | 2,79 s | 2,27 s | 660 ms | 241 ms |
| Ficha | 2,12 s | 2,15 s | 176 ms | 181 ms |

O ganho demonstrado está na home e no estoque. Na ficha, os intervalos se
sobrepõem e não há ganho significativo demonstrado neste conjunto local.
O CLS residual de 0,00236 foi identificado no texto do consentimento ao carregar
a fonte, já presente na main; não é um deslocamento da foto. A troca da grade
provisória do estoque deixou de ocorrer. A fonte não foi alterada neste PR.

## Conferência visual e limites

No celular de 390 × 844, as fotos dos cards medem 172 × 129 px nas duas versões;
a capa da ficha mede 388 × 400,84 px nas duas. O `currentSrc` é idêntico em todas
as imagens conferidas. A quantidade de requisições de imagem também é igual:
quatro na home, quatro no estoque e duas na ficha durante a captura inicial.
Os prints usam fotos reais; os testes de navegador usam uma imagem local para
não depender do Storage.

As medições são um comparativo controlado local, não uma promessa de LCP em
produção. O estoque local tem três anúncios e a ficha tem uma foto; a ficha
pública tem mais fotos. É necessário conferir a prévia da Vercel com o estoque
real e, após um merge autorizado, acompanhar os dados reais de navegação.
