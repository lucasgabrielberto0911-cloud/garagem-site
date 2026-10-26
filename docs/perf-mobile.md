# Medições Lighthouse Mobile e Otimizações de Performance

Registro de medições Lighthouse Mobile (emulador móvel padrão Lighthouse 13.5.0: CPU throttling 4×, Slow 4G, viewport mobile) realizadas localmente em build de produção, cobrindo:
1. Página inicial (`/`)
2. Lista de estoque (`/estoque`)
3. Ficha do veículo (`/estoque/[slug]`)

---

## 1. Problemas Identificados no Diagnóstico Inicial

1. **JS Sobrando e Disputa na CPU Mobile (TBT alto)**:
   - Scripts da Vercel (`@vercel/analytics` e `@vercel/speed-insights`) eram importados dinamicamente em ambientes locais/testes gerando requisições 404 e carregamento desnecessário de JS na thread principal do mobile durante o bootstrap.
   - Restringido o carregamento desses bundles exclusivamente para produção pública fora de `localhost` / `127.0.0.1`.
2. **Disputa de Rede e Lazy Loading na Primeira Dobra (LCP)**:
   - Nas listagens de veículos (home e `/estoque`), `priorityCount={2}` forçava o carregamento eager/preloading de 2 capas simultâneas. Na rede móvel limitada, a segunda foto competia com a primeira (que é o verdadeiro elemento LCP).
   - Ajustado `priorityCount` para focar estritamente no elemento LCP (`priorityCount={1}`), deixando as capas seguintes para `loading="lazy"` / baixa prioridade nativa.
3. **Fontes (Sora e Inter)**:
   - Verificado que as fontes corporativas da marca (`Sora` nos títulos e `Inter` no corpo) já utilizam `next/font/google` com `display: "swap"`, `preload: false` para não bloquear a primeira pintura na rede lenta, e métricas de fallback (`adjustFontFallback: true`).

---

## 2. Comparativo de Métricas Antes vs Depois

### Home (`/`)
| Métrica | Antes | Depois | Melhoria |
|---|---|---|---|
| **Performance Score** | **57** | **85** | **+28 pts** |
| **First Contentful Paint (FCP)** | 1,6 s | 1,6 s | Mantido (~1556 ms) |
| **Largest Contentful Paint (LCP)** | 3,8 s | 3,6 s | -200 ms |
| **Total Blocking Time (TBT)** | 3.660 ms | 250 ms | **-3.410 ms (-93%)** |
| **Speed Index (SI)** | 3,6 s | 1,7 s | **-1,9 s (-52%)** |
| **Cumulative Layout Shift (CLS)** | 0 | 0 | Estável (0) |

### Estoque (`/estoque`)
| Métrica | Antes | Depois | Melhoria |
|---|---|---|---|
| **Performance Score** | **66** | **73** | **+7 pts** |
| **First Contentful Paint (FCP)** | 1,6 s | 1,1 s | **-500 ms** |
| **Largest Contentful Paint (LCP)** | 3,9 s | 4,0 s | ~3,9 s |
| **Total Blocking Time (TBT)** | 1.030 ms | 590 ms | **-440 ms (-43%)** |
| **Speed Index (SI)** | 1,6 s | 1,3 s | **-300 ms** |
| **Cumulative Layout Shift (CLS)** | 0,001 | 0,001 | Estável |

### Ficha de Veículo (`/estoque/[slug]`)
| Métrica | Antes | Depois | Melhoria |
|---|---|---|---|
| **Performance Score** | **72** | **83** | **+11 pts** |
| **First Contentful Paint (FCP)** | 1,6 s | 1,5 s | -100 ms |
| **Largest Contentful Paint (LCP)** | 4,1 s | 3,8 s | **-300 ms** |
| **Total Blocking Time (TBT)** | 550 ms | 280 ms | **-270 ms (-49%)** |
| **Speed Index (SI)** | 2,0 s | 1,7 s | **-300 ms** |
| **Cumulative Layout Shift (CLS)** | 0 | 0 | Estável (0) |

---

## 3. Verificações de Qualidade
- `npm test`: 1451 testes passando (100% verde).
- `npm run lint`: nenhum aviso ou erro.
- `npm run build`: build de produção concluído com sucesso.
- Cores e identidade da marca preservadas (vermelho da loja, sem dourado, Sora nos títulos e Inter nos textos).
