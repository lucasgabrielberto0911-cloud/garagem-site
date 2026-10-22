# Auditoria do painel administrativo da Garagem

Data: 22/10/2026. Tarefa: `10221601abce-1`. Base analisada: `6cdd75531d64d3034f80740835308f32e6d99ead` (`origin/main`).

Retomada do WIP `7a592ba`, preservado na branch `reserva/10221601abce-1-auditoria-do-painel-admin-back`; publicação do relatório na branch `reserva/audit-admin-backend`. Os logs temporários anteriores foram perdidos na pausa da VM. As verificações e as sondas dos achados 1, 2, 4, 5 e 7 foram executadas novamente na retomada; os demais achados foram reconferidos por leitura. O achado 3 foi acrescentado após o build e a consulta aos avisos oficiais de segurança.

## Resumo

O painel gerencia estoque, reservas, clientes, contatos, vendas, documentos e conteúdo do site. A carga considerada é a de uma loja pequena, com poucos administradores e duas ou mais abas simultâneas, inclusive durante envio e limpeza de fotos.

Foram encontrados **11 achados: nenhum crítico confirmado na configuração revisada, 3 altos, 7 médios e 1 baixo**. A dependência Next.js recebe classificação crítica no npm, mas a aplicação das condições de cada aviso é discriminada no achado 3. As prioridades são atualizar o framework, impedir que um veículo com venda ativa volte à vitrine pelos atalhos de status e impedir documentos com valores diferentes da venda. Os achados não equivalem a uma invasão ou vazamento ocorrido em produção.

A entrega altera somente este relatório. Nenhuma correção de aplicação, migration, variável da Vercel ou dado de produção foi aplicada. As sondas usaram registros fictícios no PostgreSQL local `garagem_build`, com limpeza posterior.

## Método, cobertura e limites

- Leitura de `AGENTS.md`, `/home/lucas/orq/SITE.md`, tarefa, configuração de build/CI, schema, seed e migration de RLS.
- Revisão dos 23 arquivos `route.ts` em `src/app/api/admin`, dos 13 arquivos de ações em `src/app/admin` e das consultas/autenticação usadas por eles. Páginas foram verificadas nos pontos de autenticação e carregamento; não foi uma avaliação visual de todos os componentes.
- Rastreamento adicional de login/logout, `src/proxy.ts`, uploads, armazenamento privado, contador de tentativas, expiração de reservas e invalidação pública. `src/middleware.ts` não existe nesta base: a entrada é `src/proxy.ts`.
- Sondas chamaram as ações/handlers reais com Prisma real no banco local. Somente `getSession`, APIs de cache do Next e avaliação externa do anúncio foram substituídos, para evitar depender de um request do framework ou chamar integrações. Isso verifica regras de negócio, não autenticação no navegador nem o funcionamento real do ISR.
- Documentação oficial consultada para semântica de cache, autorização e buckets. Não houve teste de intrusão no site público, leitura de segredos de produção, medição de carga na Vercel ou inspeção da configuração real do Supabase.

### Matriz das APIs administrativas

Todas as linhas abaixo tiveram a guarda de sessão revisada e responderam 401 à sonda direta sem sessão. As observações de entrada, consultas e erros vêm da leitura do código; não representam e2e autenticado de cada rota. Prefixo comum: `/api/admin`.

| Rota | Métodos | Entrada, consultas e revalidação |
| --- | --- | --- |
| `/avisos` | GET | Tipo/página normalizados, listagem paginada e snapshot com cache interno |
| `/badge` | GET | Snapshot compartilhado; falha retorna contagens nulas, sem inventar zero |
| `/busca` | GET | Termo normalizado; quatro buscas limitadas em paralelo |
| `/clientes` | GET | `take` limitado no helper de consulta; resposta privada |
| `/documentos/[id]` | GET | Busca por id; PDF privado; consulta fora do `try` (11) |
| `/drafts` | GET, POST, DELETE | Chave e proprietário, teto de payload, versão e trava; erro de DELETE (11) |
| `/em-preparacao/pdf` | GET | PDF privado; carrega todos os itens de preparação, aceitável para a carga considerada |
| `/export` | GET | Limite de 10 mil, lotes de 500, snapshot `RepeatableRead` e timeout explícito de 30 s |
| `/files` | POST | Tipo/extensão e tamanho; guarda de origem; privacidade do bucket (6) |
| `/files/sign` | POST | Tipo/tamanho e bucket privado; formato de JSON (11) |
| `/files/view` | GET | URL assinada de 60 s ou redirecionamento legado; validação de referência (5, 11) |
| `/fotos/jpg` | GET | Caminho de foto validado; conversão protegida contra exceção |
| `/leads/[id]/activity` | GET, POST | Histórico limitado; nota/data validadas, transação e expiração admin; formato de JSON (11) |
| `/leads/veiculos` | GET | Opções paginadas e recuperação por id, incluindo vendido para o histórico |
| `/pedidos/compatibilidade` | POST | Valida ids e compatibilidade atual; grava auditoria e expira cache admin |
| `/session` | GET | Apenas informa validade da sessão; `private, no-store` |
| `/vehicles/[id]/sell` | PATCH | Parser próprio, trava e transação; sinal no ramo simples (4); invalidação em contexto de handler |
| `/veiculos/[id]/fotos` | GET | Busca fotos do veículo e monta ZIP em memória; destino de download (5) |
| `/veiculos/[id]/fotos/[photoId]` | GET | Confere vínculo da foto com o veículo; conversão com captura de erro |
| `/veiculos/[id]/gastos` | GET | PDF de custos do veículo; consulta fora do `try` (11) |
| `/veiculos` | GET | Página/tamanho limitados, seleção restrita e relações sem consulta por item |
| `/vendas` | GET | Página/período normalizados e consultas limitadas |
| `/vendas/veiculos` | GET | Veículos limitados; reservas buscadas por lote, sem N+1 |

## Achados altos — corrigir primeiro

### 1. Atalhos recolocam veículo com venda ativa no estoque público

**O que acontece:** a situação do anúncio pode ser alterada sem cancelar a venda correspondente. O site seleciona disponíveis pelo campo `status`, sem usar a existência de `Sale` como barreira.

**Evidências:** `src/app/admin/veiculos/actions.ts:570` (`setVehicleStatus`), `:594` (transação), `:637` e `:682` (`setVehiclesStatus`); `:369` e `:409` (`updateVehicle` também permite a transição inversa). O filtro público está em `src/lib/public-stock.ts:12` e `:18`. O caminho próprio de cancelamento existe em `src/app/admin/vendas/actions.ts:618`.

**Reprodução confirmada:** criar um veículo vendido com uma `Sale`, chamar `setVehicleStatus(id, "disponivel")` e consultar as duas tabelas. O retorno foi `ok: true`, o veículo ficou `disponivel` e a venda continuou existindo. O mesmo ocorreu com `setVehiclesStatus([id], "disponivel")`.

**Impacto se ficar:** veículo já vendido reaparece com preço e CTA de compra, enquanto faturamento e pós-venda continuam ligados à venda anterior. A invalidação pública propaga esse estado imediatamente.

**Correção mínima:** dentro da trava do veículo, impedir a volta para disponível enquanto existir venda; orientar o administrador a cancelar a venda pelo fluxo existente. Aplicar a mesma regra ao formulário completo e ao lote. Preservar a possibilidade de desfazer uma marcação simples sem `Sale`.

**Validação da futura correção:** testar os três caminhos com e sem venda, incluindo uma venda concorrente com a alteração de status. Conferir que rejeição não muda reserva, `soldAt` ou cache.

**Prioridade/esforço:** P1; impacto alto × esforço pequeno/médio, aproximadamente 3–5 h com testes.

### 2. Emissão de contrato aceita total diferente da venda registrada

**O que acontece:** `saveCommercial` confere o comprador de um veículo vendido, mas não confronta o valor do documento com `Sale.salePrice`. A soma das parcelas é comparada somente ao valor recebido no próprio formulário.

**Evidências:** `src/app/admin/veiculos/commercial-actions.ts:128`, `:143`, `:194` e `:219`. O snapshot recebe `total`/`amount` em `:242` e o vínculo `saleId` em `:250`. Já `finalizeSaleFlow` tenta detectar divergência de documentos em `src/app/admin/vendas/actions.ts:62` e `:88`.

**Reprodução confirmada:** venda de R$ 50.000 para um cliente; emitir contrato para esse mesmo cliente com `amount="40.000,00"` e pagamentos Pix de R$ 40.000. A ação retornou sucesso e criou documento com `snapshot.total=40000` ligado à venda de R$ 50.000.

**Impacto se ficar:** painel e contrato registram negociações diferentes. A checagem existente no fluxo de finalização não protege a emissão pela operação do veículo.

**Correção mínima:** para contrato ligado a uma venda, validar o total contra a venda sob a trava existente. Preencher os dados a partir da venda e exigir sua edição explícita antes de emitir um contrato com outro total. Manter propostas anteriores à venda e recibos parciais com suas regras próprias.

**Validação da futura correção:** venda de R$ 50 mil rejeita contrato de R$ 40 mil; contrato de R$ 50 mil e recibo de sinal continuam funcionando. Cobrir valores em centavos.

**Prioridade/esforço:** P1; impacto alto × esforço pequeno/médio, aproximadamente 3–5 h.

### 3. Next.js instalado tem avisos de segurança e interrompe o build

**O que acontece:** o projeto fixa Next.js 16.4.0, versão listada em avisos de segurança publicados pelo mantenedor. O build local gerou as páginas, mas terminou com `SecurityFatalError`; `npm audit --omit=dev --json` identificou uma dependência direta crítica (`next`), com três avisos associados. Isso conta pacotes vulneráveis, não incidentes nem três invasões demonstradas.

**Evidências:** `package.json:38` e `:60`, `next.config.mjs:20`, ações administrativas iniciadas por `"use server"` e ação pública em `src/app/(site)/vender/actions.ts:1`. Logs locais da retomada: `/tmp/garagem-audit-admin-build.log` e `/tmp/garagem-audit-admin-dependencies.json`.

**Aplicabilidade dos avisos oficiais:**

- [GHSA-p3m5-59mp-jv5r — negação de serviço](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r): o mantenedor descreve consumo excessivo de CPU em App Router com pelo menos uma Server Action e indica correção em 16.4.1. O projeto tem esse padrão, inclusive em rota pública; portanto a atualização é necessária. Não foi enviado payload de exploração nem medida a exposição real na Vercel.
- [GHSA-2464-fhr4-w9xw — execução remota na otimização de imagens](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw): o projeto configura `images.unoptimized: true` e declara `sharp` a partir de 0.35.5 (`package.json:42`), versão indicada pelo mantenedor como mitigação. Não se confirmou execução remota nessa configuração, nem se conferiu a árvore instalada em produção.
- [GHSA-673q-mjm6-r5xr — execução remota com Cache Components](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr): exige função `use cache` retornando múltiplos arrays tipados. A busca em `src` e na configuração não encontrou esse padrão nem `cacheComponents`. Não foi classificado como execução remota confirmada do painel.

**Impacto se ficar:** permanece um risco de indisponibilidade aplicável ao padrão usado pela aplicação; o gate de dependências do CI (`.github/workflows/ci.yml:24`) também pode bloquear PRs com o advisory atual. O alerta de pacote crítico exige atualização mesmo sem reprodução das condições de execução remota.

**Correção mínima:** abrir PR próprio de dependências com Next.js e `eslint-config-next` na mesma versão corrigida e atualizar o lockfile pelo gerenciador. O npm ofereceu 16.4.2 na consulta de 22/10/2026; confirmar a versão corrigida disponível ao executar a tarefa. Este relatório não altera dependências nem ignora o alerta.

**Validação da futura correção:** `npm audit --omit=dev --audit-level=critical`, testes, lint, tipos, build local e e2e de login, ação administrativa e formulário público. Não executar demonstração de exploração em produção.

**Prioridade/esforço:** P1; impacto alto × esforço pequeno/médio, 2–4 h incluindo regressão. Classificação alta por aplicabilidade demonstrada de negação de serviço; os avisos críticos condicionais permanecem explicitamente registrados.

## Achados médios — corrigir na sequência

### 4. Venda simples converte reserva com sinal sem a proteção do fluxo completo

**O que acontece:** no PATCH de venda, a reserva e seu sinal são verificados apenas no ramo de venda completa. A atualização de reservas para `convertida` acontece também na modalidade simples, que não cria `Sale`.

**Evidências:** `src/app/api/admin/vehicles/[id]/sell/route.ts:63` abre o ramo completo; `:71` rejeita sinal nesse ramo; `:117` converte reservas fora dele. O formulário simples não alerta sobre reserva ou sinal em `src/components/admin/VehiclesTable.tsx:1091`.

**Reprodução confirmada:** reservar veículo com sinal de R$ 1.000 e chamar o PATCH com `{}`. A resposta foi 200, a reserva ficou `convertida`, o veículo vendido e não foi criada venda. O sinal não foi apagado da tabela; o problema é convertê-lo sem a conciliação exigida nos outros fluxos.

**Correção mínima:** antes de qualquer modalidade, carregar a reserva sob a trava. Bloquear a venda simples com sinal e encaminhar ao fluxo completo existente, ou implementar uma decisão explícita sobre a reserva antes de converter seu estado.

**Validação:** PATCH simples com sinal retorna conflito sem gravação parcial; modalidade simples sem reserva permanece permitida.

**Prioridade/esforço:** P2; impacto médio × esforço pequeno, 2–3 h.

### 5. URLs de fotos e anexos não têm uma fronteira única de origem confiável

**O que acontece:** o cadastro aceita URLs de foto arbitrárias; o carregador utilizado pelo ZIP consulta URLs HTTP externas, inclusive endereços locais. Referências de anexos também são consideradas internas pela presença de um trecho do caminho, sem conferir host.

**Evidências:** `src/app/admin/veiculos/actions.ts:134` até `:168`; `src/app/api/admin/veiculos/[id]/fotos/route.ts:52`; `src/lib/photo-archive-download.ts:144` até `:154` (`fetch` sem timeout ou limite de leitura); `src/lib/storage-file-ref.ts:20` e `:39`; `src/app/api/admin/files/view/route.ts:27` redireciona a URL aceita.

**Reprodução confirmada:** `loadArchiveOriginal` buscou uma sonda HTTP em `127.0.0.1` e devolveu seu conteúdo. `parseStoredFileRef("https://externo.invalid/storage/v1/object/public/veiculos/foto.jpg")` retornou referência pública válida. Não houve consulta a metadata de nuvem ou serviço sensível.

**Impacto se ficar:** um administrador ou integração que grave uma URL manipulada pode induzir requisições do servidor a destinos internos (SSRF) ou um redirecionamento externo ao abrir anexos. Arquivo muito grande ou servidor lento também pode ocupar memória/tempo da função. Não foi demonstrado ataque anônimo nem acesso a segredo.

**Correção mínima:** validar protocolo, host configurado e caminho ao aceitar referências. Para fotos do Storage, baixar pelo bucket e caminho já validados; restringir placeholders locais a caminhos explícitos. Se downloads externos forem necessários, validar destino e redirecionamentos, com timeout e teto de bytes durante a leitura.

**Validação:** rejeitar loopback, host externo com marcador de Storage e redirecionamento para rede interna; manter fotos legítimas e placeholders necessários.

**Prioridade/esforço:** P2; impacto médio × esforço médio, 4–8 h.

### 6. Fallback de upload não rejeita bucket de documentos que esteja público

**O que acontece:** `ensurePrivateDocsBucket` retorna quando encontra o nome do bucket, sem verificar `public`. A rota de assinatura faz essa verificação adicional; a rota multipart não faz.

**Evidências:** `src/lib/supabase.ts:38` até `:58`; `src/app/api/admin/files/route.ts:103` até `:113`; comparação com `src/app/api/admin/files/sign/route.ts:46` até `:60`.

**Cenário concreto, identificado por leitura:** se `documentos` estiver público por erro de configuração, o upload assinado é bloqueado, mas o fallback multipart envia o comprovante ao mesmo bucket público. Uma referência `private://` no banco não altera a visibilidade do objeto. Buckets públicos permitem leitura por quem possui a URL, segundo a [documentação do Supabase](https://supabase.com/docs/guides/storage/buckets/fundamentals).

**Correção mínima:** validar privacidade e restrições do bucket no helper compartilhado e falhar antes de enviar. Não tornar o bucket privado automaticamente no request: isso é uma mudança operacional separada.

**Validação:** simular bucket existente com `public: true`; ambas as rotas devem falhar sem chamar upload. **Não foi verificado se produção tem essa configuração incorreta.**

**Prioridade/esforço:** P2; impacto potencial alto, condicionado à configuração × esforço pequeno, 2–3 h.

### 7. Formulário de veículo recebe mensagem interna do Prisma

**O que acontece:** criação e edição retornam `error.message` para qualquer exceção, incluindo erros de infraestrutura ou do ORM, além de registrarem o erro integral no servidor.

**Evidências:** `src/app/admin/veiculos/actions.ts:335` até `:348` e `:492` até `:499`.

**Reprodução confirmada:** editar um id removido com campos válidos retornou mensagem do Prisma contendo a operação `findUniqueOrThrow`, caminho do arquivo e trecho da chamada. O conteúdo integral não foi copiado para este relatório.

**Impacto se ficar:** o usuário recebe detalhes internos e uma mensagem sem orientação útil. Outros erros do Prisma podem carregar argumentos da operação; isso amplia a superfície de dados nos logs, sem evidenciar que uma chave tenha sido vazada nesta auditoria.

**Correção mínima:** devolver somente erros esperados de validação/domínio. Mapear registro ausente, conflito e indisponibilidade para mensagens próprias; registrar código e contexto mínimo do erro inesperado, sem payload completo.

**Validação:** erro de validação preserva `fieldErrors`; erro de banco devolve mensagem curta, sem caminho, query ou dados do formulário.

**Prioridade/esforço:** P2; impacto médio × esforço pequeno, 2–4 h.

### 8. Configurações do site usam invalidação que ainda permite leitura antiga

**O que acontece:** salvar configurações usa `revalidateTag("site-settings", "max")`, enquanto o cache público de uma hora alimenta diversas páginas e os campos do painel. O perfil `max` permite servir o valor anterior enquanto atualiza em segundo plano; a ação não garante expiração imediata para todas as consumidoras.

**Evidências:** `src/app/admin/site/actions.ts:180`; `src/lib/site-settings.ts:112` até `:133`. Há `revalidatePath` para algumas páginas em `actions.ts:181`, mas isso não substitui a expiração imediata dos dados compartilhados por todas as consumidoras.

**Cenário identificado por leitura e contrato da API:** depois de mudar endereço, uma página pública não enumerada nos `revalidatePath`, como `/privacidade`, pode servir conteúdo anterior antes de atualizar, dependendo de qual consumidora acessa o cache primeiro. O layout institucional e o rodapé usam `getPublicSite` (`src/app/(site)/layout.tsx:19`, `src/components/site/SiteFooter.tsx:28`). A distinção está nas documentações de [revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag), [revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath) e [updateTag](https://nextjs.org/docs/app/api-reference/functions/updateTag). Não se afirma que todas as páginas fiquem antigas, nem foi medido atraso real no preview.

**Correção mínima:** usar `updateTag("site-settings")` nessa Server Action e manter as revalidações específicas necessárias, sem invalidar todas as fichas.

**Validação:** aquecer o cache, editar uma configuração e verificar a primeira leitura subsequente no painel e em uma página pública consumidora.

**Prioridade/esforço:** P2; impacto médio × esforço pequeno, 1–2 h.

### 9. Limpeza mantém trava global de gravação durante chamadas ao Storage

**O que acontece:** todas as gravações que usam `withAdminStorageLock` disputam a mesma trava do PostgreSQL. A limpeza mantém essa trava durante varreduras de tabelas e páginas do Storage, inclusive na montagem da prévia; a exclusão de anexos faz o mesmo durante remoção remota.

**Evidências:** `src/lib/admin-storage-lock.ts:7` até `:12` (trava única, timeout de 60 s); `src/lib/admin-file-references.ts:9` até `:20` e `:57` até `:68`; `src/app/admin/site/cleanup-actions.ts:54`, `:62`, `:96`, `:128` e `:178`. O cadastro/edição de veículo disputa essa trava em `src/app/admin/veiculos/actions.ts:270` e `:369`.

**Cenário concreto, identificado por leitura:** uma aba monta a prévia com várias páginas do Storage; outra salva um anúncio e aguarda o mesmo lock, mesmo sendo outro veículo. A espera inclui a latência remota e ocupa conexão do pool. Não há medição de p95 de produção para quantificar a frequência.

**Correção mínima:** montar a listagem remota da prévia fora da transação; na confirmação, revalidar referências e idade em lotes pequenos, mantendo a proteção contra remover arquivo recém-vinculado. Limitar a duração do trecho protegido. Não simplesmente remover a trava existente.

**Validação:** Storage simulado com atraso e duas operações concorrentes; medir o tempo do save e provar que nenhum objeto referenciado pode ser removido durante a corrida.

**Prioridade/esforço:** P2; impacto médio × esforço médio, 4–8 h.

### 10. Seed geral é destrutivo sem barreira de ambiente e imprime senha

**O que acontece:** `prisma/seed.ts` aceita qualquer `DATABASE_URL`, remove vendas/fotos/veículos e imprime a senha calculada. Se o administrador já existir, o seed mantém seu hash, mas ainda imprime a nova senha calculada, que pode nem autenticar.

**Evidências:** `prisma/seed.ts:9` até `:34` e `:225`. O comando está em `package.json:16`. Existe um modelo de proteção local em `e2e/seed.ts:6` até `:8`. A interface ainda orienta `prisma db push` em `src/app/admin/site/actions.ts:168`, apesar de a política de produção exigir migrations SQL.

**Cenário concreto, identificado por leitura:** executar `npm run db:seed` em um shell com URL incorreta destrói os registros acessíveis. Mesmo em ambiente local, um log compartilhado recebe a senha do administrador recém-criado. **O seed não foi executado nesta auditoria.**

**Correção mínima:** exigir ambiente de teste e host/nome de banco local permitidos antes de instanciar/usar o cliente. Retirar impressão da senha e só informar se o acesso foi criado ou mantido. Substituir a orientação de `db push` no painel por mensagem operacional compatível com as migrations do projeto.

**Validação:** URL remota, banco não autorizado e ambiente sem indicador de teste devem falhar antes de qualquer escrita; capturar stdout e confirmar ausência de credencial.

**Prioridade/esforço:** P2; impacto operacional alto × esforço pequeno, 2–4 h.

## Achado baixo — corrigir junto ao endurecimento das APIs

### 11. Entradas inválidas e falhas de leitura não têm resposta consistente

**O que acontece:** algumas rotas tratam JSON malformado como falha interna ou leem propriedades antes de validar o formato. Outras consultam o banco ou decodificam referências antes do `try` responsável por produzir uma resposta controlada.

**Evidências:** `src/app/api/admin/files/sign/route.ts:34` e `:80` (`null` cai em 500); `src/app/api/admin/leads/[id]/activity/route.ts:35` e `:89`; `src/app/api/admin/documentos/[id]/route.ts:10` (consulta antes do `try`); `src/app/api/admin/files/view/route.ts:22` com `decodeURIComponent` em `src/lib/storage-file-ref.ts:24`; `src/app/api/admin/drafts/route.ts:127` (DELETE sem captura de falha).

**Cenários identificados por leitura:** `POST /api/admin/files/sign` autenticado, com integração disponível e JSON `null`, produz 500 em vez de 400. Uma referência com escape percentual inválido pode lançar exceção antes do bloco de erro do visualizador. Uma falha de banco em leitura de documento não usa a mensagem controlada do handler.

**Correção mínima:** validar `unknown` antes de acessar propriedades, distinguir 400/404/409 de 500/503 e incluir consultas/decodificação no tratamento já existente. Manter `Cache-Control: private, no-store` também nas respostas de erro; não criar um framework de erros.

**Validação:** tabela de casos `null`, array, JSON inválido, id ausente, referência com `%` inválido e banco indisponível, verificando status, conteúdo e cache.

**Prioridade/esforço:** P3; impacto baixo × esforço pequeno/médio, 3–5 h em lote.

## Pontos corretos e hipóteses descartadas

- As rotas administrativas verificam sessão dentro do handler. O proxy verifica o JWT, mas `getSession` também consulta o administrador e compara a impressão derivada de senha/e-mail (`src/lib/auth.ts:49`). Não foi encontrada rota administrativa dependente somente da proteção do proxy.
- O cookie de sessão usa `httpOnly`, `sameSite: lax` e `secure` em produção (`src/lib/auth.ts:39`). O bootstrap exige senha explícita; não há criação com senha padrão quando a variável está ausente (`src/lib/ensure-admin.ts:20`).
- O contador de login usa incremento atômico no PostgreSQL, chave em hash e janela compartilhada (`src/lib/admin-login-limit.ts:23`). O fallback em memória existe quando os serviços compartilhados falham (`src/lib/rate-limit.ts:122`); não foi demonstrado bypass do login com banco operacional.
- SQL sensível utiliza parâmetros; vendas/reservas usam transações e trava do veículo. Consultas principais têm paginação limitada e relações selecionadas; não foi identificado um N+1 relevante nas listagens usuais. A serialização de rede sob lock está descrita no achado 9.
- A invalidação por veículo distingue Server Action de Route Handler, inclui slug antigo quando necessário e evita invalidar todas as fichas no fluxo unitário (`src/lib/public-stock-revalidate.ts:21`, `:51`). O PATCH novo passa `"route-handler"`, corretamente.
- A chamada ampla `revalidateAllPublicFichas` existe para manutenção em lote e tem justificativa explícita (`src/lib/public-stock-revalidate.ts:85`). Não foi classificada como bug dos fluxos unitários.
- A exclusão de veículo com `Sale` não apaga automaticamente a venda: a relação em `prisma/schema.prisma:204` não usa cascade. Não se confirmou a hipótese de exclusão silenciosa do histórico de vendas por essa ação.
- A migration `supabase/migrations/20261021000100_rls_hardening.sql:49` habilita RLS e revoga acesso de `anon`/`authenticated`. Ela documenta que Prisma usa o dono das tabelas. Isso não prova que a migration esteja aplicada em produção; a [documentação de RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) foi usada como referência, sem consultar o projeto remoto.
- O changelog do Supabase foi consultado. A [mudança anunciada para cifras TLS antigas](https://supabase.com/changelog/cbc-tls-ciphers-deprecated), prevista a partir de 10/11/2026, não sustenta um defeito deste backend Node; não foi incluída como achado.

### Variáveis de ambiente e fronteiras verificadas

A revisão conferiu nomes e uso no código; não leu valores das credenciais de produção nem alterou a configuração da Vercel.

| Configuração | Evidência e conclusão |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | `prisma/schema.prisma:5` e `src/lib/prisma.ts:7`: clientes usam as variáveis; o aviso de conexão direta não impede uma configuração incorreta. As URLs usadas nas verificações locais passaram por guarda de host e nome de banco. Pool e permissões reais permanecem sem verificação. |
| `JWT_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/secrets.ts:15`: segredo explícito ou derivação da service role; ausência de ambos falha. Não há segredo padrão nessa função. A auditoria não mediu a força do valor configurado. |
| `ADMIN_BOOTSTRAP_PASSWORD` | `src/lib/ensure-admin.ts:20`: bootstrap só é habilitado com valor explícito de pelo menos oito caracteres. Não se verificou se a variável permanece configurada em produção. |
| Storage | `src/lib/supabase.ts:11`: cliente privilegiado exige service role, sem fallback para a chave pública. A assinatura de upload exige integração configurada e bucket privado; a divergência do multipart está no achado 6. |
| `CRON_SECRET` | `src/app/api/cron/reservas/route.ts:9`: cron recusa segredo ausente e Authorization divergente antes de expirar reservas. A configuração e a execução real do agendamento não foram consultadas. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RATE_LIMIT_MEMORY_ONLY` | `src/lib/rate-limit.ts:89` e `:122`: login prioriza contador compartilhado no banco e dispõe de fallback. O bypass explícito de banco por `RATE_LIMIT_MEMORY_ONLY` afeta o helper distribuído; isso não elimina a primeira tentativa do contador de login no PostgreSQL. |

Não se atribuiu vazamento à simples presença de nomes de variáveis no código. As evidências concretas de exposição de detalhes e senha são os achados 7 e 10.

## Validações executadas

As URLs de `DATABASE_URL` e `DIRECT_URL` foram verificadas por código antes de qualquer acesso: host loopback e banco `/garagem_build`. Variáveis foram carregadas de `/home/lucas/garagem-site/.env.build.local`, sem impressão dos valores.

| Verificação | Resultado |
| --- | --- |
| `npx prisma db push --skip-generate` no PostgreSQL local | Schema local conferido; sem alteração em produção |
| `npm test` | Passou: 1.399 testes, 0 falhas, cerca de 365 s |
| `npm run lint` | Passou, código de saída 0 |
| `npx tsc --noEmit` | Passou, código de saída 0, sem diagnósticos |
| `npm run build` com banco local | Duas execuções com saída 1 pelo alerta `SecurityFatalError` do Next.js, após compilar, verificar tipos e gerar páginas. Build não passou; ver achado 3 |
| `npm audit --omit=dev --json` | Uma dependência crítica (`next`), com três avisos; aplicabilidade detalhada no achado 3 |
| Sondas de negócio com Prisma local | Confirmados status individual/lote, contrato divergente, reserva com sinal, erro Prisma e HTTP loopback |
| Handlers administrativos sem sessão | 26 handlers nos 23 arquivos de rota retornaram 401 com `getSession()` nulo; chamada direta, sem proxy |

Logs locais temporários: `/tmp/garagem-audit-admin-{tests,lint,types,build,build-retry,probes}.log`; auditoria em `/tmp/garagem-audit-admin-dependencies.json`. Sondas temporárias: `/tmp/garagem-audit-admin-probes.cjs`. Esses arquivos não integram a entrega. Cache e autenticação simulados nas sondas não substituem e2e HTTP.

Não foram executados Playwright, Lighthouse ou preview: nenhuma tela/código foi alterado. Também não foram aplicadas migrations de RLS ao banco remoto nem validados permissões, pool, limites ou variáveis reais da Vercel/Supabase. O build com banco local não valida disponibilidade da produção.

## Pendência de build antes de integrar

O relatório está concluído e os testes, lint e tipos passaram. O build falhou nas duas execuções com `SecurityFatalError`, por avisos de segurança do Next.js 16.4.0 já fixado na base, incluindo [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r). O problema é pré-existente e não foi causado pela auditoria, que altera somente este relatório. A publicação em Draft PR foi autorizada pelo orquestrador com essa pendência documentada. A atualização do framework deve ocorrer em tarefa própria por agente autorizado, seguida de nova validação antes de retirar o PR de rascunho. Nenhuma dependência ou dado de produção foi alterado nesta entrega.

## Tarefas prontas para virar issue/PR

As estimativas são de implementação e regressão local; não incluem espera de revisão/deploy. Todas as correções devem sair em PR rascunho por agente autorizado a programar.

| Ordem | Tarefa e arquivos-alvo | Critério de aceite | Esforço |
| --- | --- | --- | --- |
| P1 | Atualizar Next.js com avisos de segurança — `package.json` e lockfile | Next/config ESLint corrigidos; auditoria, build e regressão dos formulários passam | 2–4 h |
| P1 | Proteger status contra venda ativa — `admin/veiculos/actions.ts` e testes de ações | Individual, lote e formulário rejeitam retorno com `Sale`; marcação simples continua reversível | 3–5 h |
| P1 | Validar contrato contra venda — `admin/veiculos/commercial-actions.ts` | Total divergente é rejeitado sem criar documento; sinal e proposta pré-venda preservados | 3–5 h |
| P2 | Proteger sinal na venda simples — `api/admin/vehicles/[id]/sell/route.ts` | Reserva com sinal não é convertida pelo PATCH simples | 2–3 h |
| P2 | Restringir URLs de arquivos — `storage-file-ref.ts`, `photo-archive-download.ts`, ações de veículo | Host manipulado e acesso interno são rejeitados; downloads legítimos passam | 4–8 h |
| P2 | Unificar validação do bucket privado — `supabase.ts`, APIs de arquivos | Nenhum caminho envia documento para bucket público | 2–3 h |
| P2 | Sanitizar erros do formulário — `admin/veiculos/actions.ts` | Falha Prisma não devolve detalhes internos; erros de campo continuam úteis | 2–4 h |
| P2 | Expirar configurações imediatamente — `admin/site/actions.ts` | Primeira leitura após salvar já usa o valor novo | 1–2 h |
| P2 | Reduzir duração da trava de arquivos — `admin-storage-lock.ts`, `admin-file-references.ts`, `cleanup-actions.ts` | Prévia lenta não bloqueia save; confirmação mantém integridade dos vínculos | 4–8 h |
| P2 | Bloquear seed fora do ambiente local — `prisma/seed.ts`, mensagem de `admin/site/actions.ts` | Nenhuma escrita antes da guarda e nenhuma senha em stdout | 2–4 h |
| P3 | Padronizar casos inválidos das APIs revisadas | Payload inválido retorna 400; falha interna retorna erro controlado sem cache | 3–5 h |

Agrupar correções pequenas do mesmo fluxo: status/sinal; documentos; arquivos; erros/cache do painel. Não misturar estes temas com mudanças visuais ou identidade da marca. A implementação requer validação dos fluxos afetados. Não foi solicitado preview.

**Parecer:** priorizar a atualização de segurança do Next.js e a consistência entre estoque, venda e contrato. A autenticação tem proteções relevantes; melhorias de desempenho vêm depois dessas correções. Permanecem sem verificação o ambiente de produção, o e2e no navegador e a latência real de cache/Storage.
