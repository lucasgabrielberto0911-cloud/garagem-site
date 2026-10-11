# Garagem — site e painel

Site público de seminovos da Garagem (Linhares/ES) e painel administrativo da loja.
Produção: <https://www.suagaragem.net>.

## Stack

- Next.js (App Router, React 19, React Compiler) e Tailwind CSS 3
- PostgreSQL no Supabase, acessado com Prisma (`prisma/schema.prisma`)
- Fotos e documentos no Supabase Storage (bucket público `veiculos`, privado `documentos`)
- Deploy na Vercel (região `gru1`, ver `vercel.json`)
- Assistente do site com Gemini (`GEMINI_API_KEY`)

## Como está organizado

| Pasta | O que tem |
| --- | --- |
| `src/app/(site)`, `(catalog)`, `(vehicle)` | Páginas públicas: home, estoque, ficha do veículo, vender, pedido, FAQ, cidades |
| `src/app/admin` | Painel (protegido por `src/proxy.ts` e por sessão em cada ação) |
| `src/app/api` | Rotas: chat, estoque, upload, catálogo Meta, saúde, fotos |
| `src/components/site`, `src/components/admin` | Componentes do site e do painel |
| `src/lib` | Regras de negócio, consultas, SEO, chat e testes (`*.test.ts`) |
| `prisma` | Schema, seed e SQLs aditivos (`prisma/sql`) |
| `e2e` | Percursos no navegador (Playwright) |
| `docs` | Operação (`ops.md`), painel, avaliação do chat, prévias de fotos antigas |
| `branding` | Logo e imagens originais da marca |

## Rodar localmente

```bash
cp .env.example .env      # preencha DATABASE_URL, DIRECT_URL e as chaves do Supabase
npm ci
npm run db:push           # aplica o schema no banco
npm run dev
```

Nunca use o banco de produção para testes. O painel só cria um administrador com
`ADMIN_BOOTSTRAP_PASSWORD` definido (veja `.env.example`).

## Testes e verificações

```bash
npm test                  # testes de lógica
npm run lint
npm run build
npm run e2e:seed && npm run test:e2e   # exige E2E_TEST=1 e banco local `ci` ou `garagem_e2e`
```

O CI (`.github/workflows/ci.yml`) roda tudo isso.
Veja `e2e/README.md` para os percursos cobertos.

## Regras que não podem quebrar

- WhatsApp único da loja: (27) 99633-0706. Instagram: @suagaragem1.
- A marca visível é só "Garagem" (nunca "Sua" ao lado do logo); vermelho `#F80000`.
- Não inventar preço, km, equipamento, laudo ou vistoria. "Consignado" nunca aparece para o cliente.
- Carro vendido: ficha responde 200, título com "(vendido)", `noindex, follow`, sem preço e sem Offer com preço.
- A cidade do veículo aparece só no admin.
- No celular, o estoque mostra 2 carros por linha.
- Não aumentar escritas de ISR nem ligar a otimização paga de imagens da Vercel (ver `docs/ops.md`).
- `robots.txt` bloqueia só `/admin` e `/api`; `sitemap.xml` deve responder 200.

## Operação

Região, retenção de deploys, catálogo Meta e imagens: [`docs/ops.md`](docs/ops.md).
SQLs que precisam ser aplicados à mão no Supabase: [`prisma/sql`](prisma/sql).
