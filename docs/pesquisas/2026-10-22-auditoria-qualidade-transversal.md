# Relatório de Auditoria de Qualidade Transversal (Testes, Types, Lint, Build, Cache, CI)

Data: 2026-10-22  
Repositório: `garagem-site`  
Branch auditada: `reserva/10221601abce-3-auditoria-de-qualidade-transve`  
Ambiente: VM `garagem-dev` (Linux, Node.js 22, Postgres 16 local)

---

## 1. Resumo Executivo

Foi realizada uma auditoria transversal profunda cobrindo:
- **TypeScript**: verificação com `npx tsc --noEmit` e análise do `tsconfig.json`.
- **Linting**: verificação com `npm run lint` e análise do `eslint.config.mjs`.
- **Testes Unitários**: execução da suíte completa de **1.399 testes** (`npm test`), medição de tempos e análise de estabilidade/flakiness.
- **Cobertura e Gaps**: mapeamento dos 232 arquivos em `src/lib/` vs 193 arquivos `.test.ts`, com foco em áreas críticas (`chat`, `stock`, `auth`, `revalidação`).
- **Build Local**: execução do pipeline completo `prisma generate && next build` integrado ao banco local `garagem_build` via `.env.build.local`.
- **Dependências e Segurança**: auditoria de vulnerabilidades via `npm audit` e verificação do comportamento no CI.
- **Cache e ISR**: auditoria de uso de `force-dynamic` e chamadas a `revalidatePath` / `revalidateTag` / `updateTag`.
- **Scripts de Seed e CI**: análise de segurança em `prisma/seed.ts`, `e2e/seed.ts`, `scripts/vercel-ignore.sh` e `.github/workflows/ci.yml`.

A saúde geral da base de código é **excepcional**: 1.399 testes passando (0 falhas), zero erros de TypeScript e zero erros de ESLint. Foram identificados pontos cruciais de atenção, incluindo uma vulnerabilidade crítica no Next.js que afeta o CI, falta de proteção em `prisma/seed.ts` e ausência de testes unitários na camada de autenticação (`jwt.ts` e `auth.ts`).

---

## 2. Resultados das Verificações

### 2.1. TypeScript (`npx tsc --noEmit`)
- **Status**: ✅ **Aprovado (0 erros)**.
- **Tempo de execução**: ~1m15s na VM.
- **Achado de Qualidade (`tsconfig.json`)**:
  - `compilerOptions.strict` está ativo (`true`).
  - `"**/*.test.ts"` está em `exclude: ["node_modules", "**/*.test.ts"]`.
  - **Impacto**: os arquivos de teste unitário (`src/lib/*.test.ts`) **não são tipados** durante o `tsc --noEmit`. Quando contratos ou interfaces de funções mudam, os testes rodam via `tsx` (que ignora checagem de tipos estritos) e podem mascarar divergências de assinatura.

### 2.2. Linting (`npm run lint` / ESLint 9)
- **Status**: ✅ **Aprovado (0 erros, 0 warnings)**.
- **Configuração (`eslint.config.mjs`)**:
  - Utiliza flat config com `eslint-config-next/core-web-vitals` e `eslint-config-next/typescript`.
  - Regras desativadas intencionalmente para compatibilidade com padrões do React 19:
    - `react-hooks/set-state-in-effect: off`
    - `react-hooks/refs: off`
  - `@typescript-eslint/no-unused-vars` configurado como `warn`, ignorando variáveis com prefixo `_`.

### 2.3. Testes Unitários (`npm test`)
- **Status**: ✅ **1.399 testes passaram (100%)**, 0 falhas, 0 cancelados, 0 pulados.
- **Duração total**: ~179.754 ms (~3 minutos).
- **Flakiness**: Zero testes flaky observados. Todos os testes determinísticos e isolados.
- **Hotspots de Tempo**:
  - Geração de PDFs (`src/lib/commercial-pdf.test.ts` e `src/lib/preparation.test.ts`): testes individuais levam entre 10s e 29s devido ao embedding de fontes Sora e Inter e rendering de múltiplas páginas com `pdf-lib`.
  - Baterias de chat (`chat-bateria40.test.ts`, `chat-qa-bateria40.test.ts`, etc.): executam simulações completas de intenção de compra.

### 2.4. Build Local (`npm run build` com `.env.build.local`)
- **Status**: ✅ **Aprovado (Exit code 0)**.
- **Páginas pré-renderizadas**: 74/74 páginas SSG geradas com sucesso.
- **Avisos no Build**:
  1. `⚠ Your version of Next.js is affected by a known security vulnerability. This command is continuing after the upgrade reminder.`
  2. `warn The configuration property package.json#prisma is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., prisma.config.ts).`
  3. `[prisma] DATABASE_URL parece conexão direta (porta 5432)...` (aviso emitido pela checagem de conexão do Prisma, esperado no ambiente de build local).

---

## 3. Análise de Cache, ISR e Rotas Dinâmicas

### 3.1. Uso de `force-dynamic`
- **Total de ocorrências**: 21 arquivos.
- **Auditoria de Conformidade**:
  - **Rotas Administrativas** (`src/app/admin/*` e `src/app/api/admin/*`): Todas justificadas. São rotas privadas autenticadas que necessitam de dados em tempo real.
  - **Rotas de Mídia sob demanda** (`/api/foto-jpg`, `/api/catalog-jpg`): Justificadas para conversão sob demanda com sharp.
  - **Rotas de Catálogo da Meta** (`/api/meta/catalog.csv` e `/catalog/meta.csv`): Justificadas; utilizam cabeçalhos CDN `s-maxage` sem passar por ISR.
  - **Páginas Públicas** (`src/app/(catalog)`, `src/app/(site)`, `src/app/(vehicle)`): **Nenhuma** utiliza `force-dynamic`. Todas utilizam `revalidate = 3600` (1 hora) e dependem de invalidação via Server Actions do painel. **100% em conformidade com as diretrizes**.

### 3.2. Uso de `revalidatePath`
- O projeto segue a regra de ouro de nunca chamar `revalidatePath("/estoque/[id]", "page")` em atualizações individuais de estoque.
- O único local com a chamada wildcard de página é `revalidateAllPublicFichas()` em `src/lib/public-stock-revalidate.ts`, documentado e reservado exclusivamente para backfills de fotos/galerias em massa, com teste unitário estrutural garantindo essa invariante.
- Todas as atualizações pontuais usam `revalidatePublicStock(id)`, revalidando apenas o slug canônico do veículo alterado.

---

## 4. Dependências e Segurança (`npm audit`)

### 4.1. Vulnerabilidade Crítica no Next.js 16.4.0
O `npm audit` detectou **1 vulnerabilidade crítica** e **9 vulnerabilidades de risco alto/moderado**:
1. **`next@16.4.0` (Critical)**:
   - **GHSA-2464-fhr4-w9xw**: RCE não autenticado na API de Image Optimization quando arquivos SVG são utilizados.
   - **GHSA-p3m5-59mp-jv5r**: Denial of Service no App Router ao utilizar Server Actions.
   - **GHSA-673q-mjm6-r5xr**: RCE não autenticado em funções `use cache` retornando TypedArrays.
   - **Impacto no CI**: O workflow `.github/workflows/ci.yml` executa na linha 24:
     ```yaml
     - run: npm audit --omit=dev --audit-level=critical
     ```
     Como o Next.js está em `dependencies`, esse comando **falha com exit code 1** no CI atual caso a verificação seja disparada.
   - **Remediação**: Atualizar `next` para `>= 16.4.2` em PR dedicado.

2. **`braces` (High) e `postcss-selector-parser` (Moderate)**:
   - Vulnerabilidade de DoS por regex em `braces` através de `chokidar` (dependência de `tailwindcss@3.4.1`) e `@next/eslint-plugin-next`.
   - Remediação definitiva ocorrerá na migração futura para Tailwind v4; em Tailwind v3, pode ser mitigado via `overrides` no `package.json` se necessário.

---

## 5. Mapeamento de Gaps de Cobertura de Testes

Existem 232 arquivos de código em `src/lib/` e 193 arquivos `.test.ts`. As seguintes áreas críticas apresentam gaps de cobertura unitária direta:

| Área | Arquivo sem teste direto | Risco | Descrição / Recomendação |
|---|---|---|---|
| **Auth** | `src/lib/jwt.ts` | **Alto** | Assinatura e verificação de tokens JWT via `jose`. Não há teste unitário validando expiração, algoritmo HS256 e rejeição de token adulterado. |
| **Auth** | `src/lib/auth.ts` | **Alto** | Criação e leitura de cookies de sessão (`SESSION_COOKIE`), payload e opções seguras de cookie. |
| **Stock** | `src/lib/vehicle-slug.ts` | **Médio** | Responsável pelas URLs canônicas (`/estoque/<slug>`). Não há teste direto cobrindo acentuação, espaços duplos, pontuação e sufixo de CUID. |
| **Stock** | `src/lib/vehicles.ts` | **Médio** | Consultas públicas do catálogo e cache tags (`VEHICLES_PUBLIC_CACHE_TAG`). |
| **Stock** | `src/lib/public-vehicle-cards.ts` | **Médio** | Montagem e filtragem de cards de veículos (garantia de preço omitido quando vendido). |
| **Chat** | `src/lib/chat-openrouter.ts` | **Médio** | Fallback para provedor OpenRouter quando Gemini esgota cota ou retorna erro 5xx. |
| **Chat** | `src/lib/chat-stock-cache.ts` | **Baixo** | Gerenciamento de cache em memória dos dados de estoque para o assistente. |

---

## 6. Auditoria de Scripts e CI

### 6.1. Proteção de Banco em `prisma/seed.ts`
- **Achado Crítico**: Em `e2e/seed.ts`, existem guardas exemplares:
  ```typescript
  if (process.env.E2E_TEST !== "1" || !["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) || !["/ci", "/garagem_e2e"].includes(database.pathname)) {
    throw new Error("E2E exige banco local dedicado (ci ou garagem_e2e) e E2E_TEST=1.");
  }
  ```
  Por outro lado, o arquivo `prisma/seed.ts` **não possui nenhuma validação de host**. Ele executa diretamente:
  ```typescript
  await prisma.sale.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.vehicle.deleteMany();
  ```
  Se um operador ou script executar `npm run db:seed` sem configurar `.env.build.local`, o comando pode rodar contra o banco configurado no `.env` padrão e apagar dados.
- **Recomendação**: Adicionar verificação explícita em `prisma/seed.ts` exigindo confirmação ou bloqueando hosts remotos/Supabase.

### 6.2. Depreciação do Prisma 7
- `package.json` declara:
  ```json
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
  ```
  O Prisma emite warning em todos os comandos:
  `warn The configuration property package.json#prisma is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., prisma.config.ts).`
- **Recomendação**: Criar `prisma.config.ts` para antecipar a compatibilidade com Prisma 7.

### 6.3. Script de Preview na Vercel (`scripts/vercel-ignore.sh`)
- O script realiza consulta à API do GitHub:
  `curl -fsS --max-time 8 "https://api.github.com/repos/.../issues/${PR_ID}/labels"`
  sem cabeçalho de autenticação.
- Em ambientes serverless compartilhados, requisições anônimas à API do GitHub podem sofrer rate-limiting (HTTP 403), fazendo com que a resposta seja vazia e o build seja ignorado mesmo com a label `preview`.
- **Recomendação**: Manter o uso preferencial da tag `[preview]` na mensagem de commit para garantir o disparo de builds de preview sem dependência de rate-limit da API externa.

---

## 7. Tabela de Prioridades e Tarefas Recomendadas

| Prioridade | Tarefa | Impacto | Esforço |
|---|---|---|---|
| **P1** | Atualizar Next.js para `>= 16.4.2` para sanar vulnerabilidade crítica e manter `npm audit --audit-level=critical` verde no CI | Alto (Segurança / CI) | Baixo |
| **P1** | Adicionar guarda de segurança em `prisma/seed.ts` contra execução acidental em bancos remotos | Alto (Prevenção de desastre) | Baixo |
| **P2** | Criar testes unitários para `src/lib/jwt.ts` e `src/lib/auth.ts` | Médio (Segurança / Regressão) | Baixo |
| **P2** | Criar teste unitário dedicado para `src/lib/vehicle-slug.ts` | Médio (SEO / URLs canônicas) | Baixo |
| **P3** | Migrar configuração `package.json#prisma` para `prisma.config.ts` | Baixo (Manutenibilidade) | Baixo |
| **P3** | Adicionar `tsconfig.test.json` ou incluir testes no typecheck do CI | Médio (Qualidade de código) | Médio |
