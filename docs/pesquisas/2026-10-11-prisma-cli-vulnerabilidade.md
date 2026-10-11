# Correção da vulnerabilidade transitiva da CLI do Prisma

## Resumo

Mantidos `prisma` e `@prisma/client` em 6.19.3. Foi adicionado um override restrito a `@prisma/config` para instalar `deepmerge-ts` 8.0.0, com atualização do lockfile pelo npm. Schema, gerador, saída do client e código da aplicação permaneceram iguais. Não há lógica pura nova que exija novos arquivos `*.test.ts`.

## Advisory e exposição

- [GHSA-ggr8-5vv4-36mx / CVE-2026-40345](https://github.com/advisories/GHSA-ggr8-5vv4-36mx): severidade alta, CVSS 4.0 de 8,2 e CWE-674. Afeta `deepmerge-ts <8.0.0`; corrigido em 8.0.0.
- A falha esgota a pilha ao mesclar objetos com referências circulares coincidentes. JSON comum não cria essa condição; a exploração exige esses objetos controlados por um atacante.
- Cadeia identificada por `npm ls` e `npm explain`: `prisma@6.19.3 → @prisma/config@6.19.3 → deepmerge-ts@7.1.5`. É uma dependência transitiva da CLI.
- Apesar de `prisma` estar em devDependencies, `@prisma/client` declara a CLI como peer opcional. Por isso a cadeia também aparecia em `npm audit --omit=dev`. Não se deve classificá-la como exclusivamente dev pela posição no manifesto.
- A exposição observada neste repo é o carregamento de configuração da CLI no build/desenvolvimento. A aplicação importa `PrismaClient`, sem imports de `deepmerge-ts` ou `@prisma/config` em `src/`. Não foi identificado caminho de entrada pública para os objetos circulares; isso é uma avaliação do código, não uma garantia sobre todo ambiente de implantação.

## Decisão e evidências

- `npm view prisma@6 version`: a versão mais recente da série é 6.19.3.
- `npm view @prisma/config@6.19.3 dependencies`: a dependência vulnerável é fixada em 7.1.5. Atualizar dentro da série 6 não resolve atualmente.
- `package.json:10`: o build executa `prisma generate && next build`.
- `package.json:29`, `package.json:60`: CLI e client continuam na mesma série e versão instalada.
- `package.json:43`: override limitado ao consumidor `@prisma/config`, com versão exata 8.0.0.
- `prisma/schema.prisma:1` e `prisma/schema.prisma:5`: gerador e datasource inalterados. O client gerado continua 6.19.3; não há alteração de contrato do banco ou necessidade de migração introduzida pela correção. A conexão ao banco de produção não foi testada.
- `.github/workflows/ci.yml:35`: CI usa Node 24.

A [release 8.0.0](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0) altera a mesclagem de Maps, nomes de tipos e a mutação de entradas em `deepmergeInto`. O override atravessa uma versão major da dependência transitiva; o risco fica na compatibilidade da configuração da CLI. Foram exercitados `defineConfig`, mesclagem de objetos de configuração e geração do client. Configurações futuras com Maps ou customizações de merge merecem revalidação.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm ci` inicial | Passou usando cache em `/tmp`; cache padrão era somente leitura |
| `npm install` após override | Apenas um pacote alterado; lockfile atualizado |
| `npm audit` antes | 12 apontamentos: 10 altos, 2 moderados; 3 da cadeia Prisma |
| `npm audit` depois | 9 apontamentos: 7 altos, 2 moderados; nenhum da cadeia Prisma |
| `npm audit --omit=dev` antes/depois | 3 altos → zero vulnerabilidades |
| `npx prisma generate` | Passou; client 6.19.3, saída original |
| `env -u JEV_API_KEY npm test`, com Node 24 | 915 testes passaram |
| `npm run lint` | Passou |
| `npx tsc --noEmit` | Passou |
| `npm run build`, uma execução | Passou; compilação, TypeScript e 56 páginas concluídos |
| Verificação isolada das APIs | `defineConfig` e merge de campos preservados; PoC circular em `deepmerge` e `deepmergeInto` sem esgotar a pilha |
| `git diff --check` | Passou |

Foram removidas `DATABASE_URL`, `DIRECT_URL` e `JEV_API_KEY` do ambiente dos comandos que poderiam carregá-las. O build registrou erros de ausência de `DATABASE_URL`, tratados pelos fallbacks existentes; nenhuma conexão real foi utilizada. Os caches de npm e Prisma foram direcionados a `/tmp` (`npm_config_cache` e `XDG_CACHE_HOME`). Nenhuma variável da Vercel foi alterada.

A primeira suíte começou antes de concluir a geração e falhou na inicialização do client. Depois de gerá-lo, o Node 20.19.2 do ambiente deixou somente um teste de Storage com falha: o Supabase instalado exige WebSocket nativo/Node 22+. A repetição com Node 24.21.0, obtido via `npm exec --package=node@24`, passou integralmente, sem modificar testes ou aplicação. Lint, TypeScript e o único build passaram no Node 20 disponível.

## Prioridades e tarefas para o coordenador

1. **Alta prioridade / baixo esforço:** revisar e abrir o PR rascunho desta correção; conferir CI com Node 24. Não houve push, abertura de PR ou merge pelo agente.
2. **Média prioridade / esforço separado:** criar issue para os nove apontamentos restantes, ligados a Tailwind/PostCSS/ESLint. Não foram corrigidos nesta tarefa.
3. **Baixa prioridade / baixo esforço:** acompanhar atualização oficial do Prisma 6 que consuma a dependência corrigida e remover o override quando possível.

Ficaram fora: Prisma 7, alterações no schema, migrações, seeds, acesso ao banco, mudanças de interface, chat, layout, configuração da Vercel e correções de dependências sem relação com o Prisma.
