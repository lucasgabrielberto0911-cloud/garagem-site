# Diagnóstico do CI dos PRs #364 e #365

Data: 22/10/2026. Tarefa: `10221838cad1-1`.

## Resumo e escopo

Os dois PRs falham no audit crítico porque ainda usam Next.js 16.4.0. Há também duas ocorrências diferentes no quarto shard: no #364, a instalação de dependências do Playwright ficou presa em acesso aos mirrors do Ubuntu até estourar o limite do job; no #365, um teste encontrou dois campos de placa e falhou por seletor ambíguo. O job `check` apenas propagou essas conclusões.

A instrução final do arquivo da tarefa define esta subtarefa como auditoria: somente relatório, commit e push, sem editar código e sem abrir PR. Portanto, este documento não afirma que os PRs foram corrigidos nem que seus CIs estão verdes. A consolidação e as correções abaixo ficam como tarefas de implementação para o coordenador.

## Evidências e estado observado

| PR | Commit analisado | CI | Resultado |
| --- | --- | --- | --- |
| [#364](https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/364) | `42ce813deb2a924cccf8ad0c26f6d5cdf2ef5dae` | [39848963954](https://github.com/lucasgabrielberto0911-cloud/garagem-site/actions/runs/39848963954) | `unit`: falha; e2e 1/2/3 e migrations: sucesso; e2e 4: cancelado pelo limite de tempo; `check`: falha |
| [#365](https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/365) | `be4cf42d8cc16dad5af4d84c5126b3eec9f43583` | [39849065821](https://github.com/lucasgabrielberto0911-cloud/garagem-site/actions/runs/39849065821) | `unit`: falha; e2e 1/2/3 e migrations: sucesso; e2e 4: uma falha de teste; `check`: falha |

`gh pr checks 364` e `gh pr checks 365` retornaram código 1. Os status da Vercel dizem `Canceled by Ignored Build Step`: não demonstram build ou preview remoto bem-sucedido. Não foi solicitado novo preview.

### Alta — dependência vulnerável bloqueia o audit nos dois PRs

**Onde:** `package.json:38` e `package.json:60` nos dois commits analisados; `.github/workflows/ci.yml:24` no mesmo histórico.

**Evidência:** os jobs [unit do #364](https://github.com/lucasgabrielberto0911-cloud/garagem-site/actions/runs/39848963954/job/120069705042) e [unit do #365](https://github.com/lucasgabrielberto0911-cloud/garagem-site/actions/runs/39849065821/job/120070057842) encerram em `npm audit --omit=dev --audit-level=critical`, código 1, com uma vulnerabilidade crítica em `next 16.0.0 - 16.4.0`. O relatório do npm lista GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r e GHSA-673q-mjm6-r5xr e indica Next.js 16.4.2 como correção. As versões de `next` e `eslint-config-next` nesses PRs estão fixadas em 16.4.0.

**Por que importa:** testes unitários, lint e type-check foram **pulados**, não reprovados, nesses jobs. Reexecutar o mesmo commit não corrige o audit. O bloqueio é pré-existente na base, não foi introduzido pelas alterações de regras públicas ou identidade visual.

**Como corrigir:** reaplicar a atualização já validada no PR #362, mantendo Next.js e eslint-config-next em 16.4.2, lockfile correspondente e a migração do seed para `prisma.config.ts`. Não remover o audit, baixar sua severidade nem usar uma instalação local divergente do lockfile como prova. Depois de `npm ci`, confirmar as versões efetivas e repetir audit, testes, lint, tipos e build.

**Impacto × esforço:** alto × baixo. O [CI do #362](https://github.com/lucasgabrielberto0911-cloud/garagem-site/actions/runs/39847469692) já validou esse patch; o [CI do #363](https://github.com/lucasgabrielberto0911-cloud/garagem-site/actions/runs/39851648565) também ficou verde após reaplicá-lo.

### Média — #364 perde o job em dependências do runner, antes dos testes

**Onde:** `.github/workflows/ci.yml:31` e `:73` no commit do #364: limite de 25 minutos e `npx playwright install-deps chromium` após acerto do cache.

**Evidência:** no [e2e (4) do #364](https://github.com/lucasgabrielberto0911-cloud/garagem-site/actions/runs/39848963954/job/120069705716), `Playwright (deps)` começou às 20:28:07 UTC e foi cancelado às 20:52:30 UTC. O log mostra tentativas `Ign:` de `azure.archive.ubuntu.com` e acesso a `archive.ubuntu.com`. Não há avanço depois de 20:28:26 até o cancelamento. A anotação do GitHub confirma que o job excedeu 25 minutos. Prisma, seed, build e testes desse shard foram pulados. No #365, a mesma etapa levou 13min06s, mas terminou.

**Por que importa:** não existe evidência de falha funcional do site nesse shard do #364. A rede/instalação do runner consumiu o orçamento do job. A causa específica do travamento do mirror não foi reproduzida nesta VM.

**Como corrigir:** após corrigir as dependências da aplicação, reexecutar o job afetado para distinguir uma ocorrência de infraestrutura de falha reproduzível. Se repetir, limitar o tempo por tentativa da instalação e permitir nova tentativa controlada; investigar os mirrors acessados no runner. Manter a instalação das bibliotecas de sistema mesmo com cache do browser: o cache de `~/.cache/ms-playwright` não comprova que as dependências do SO estejam instaladas. Não aumentar apenas o timeout global nem desativar o shard.

**Impacto × esforço:** médio × baixo para nova execução; médio para endurecer a instalação, se necessário. Uma mudança de imagem/runner deve ser avaliada separadamente, com versão compatível do Playwright.

### Média — #365 tem seletor estrito ambíguo no formulário de venda

**Onde:** [`e2e/lote-site.spec.ts:18`](https://github.com/lucasgabrielberto0911-cloud/garagem-site/blob/be4cf42d8cc16dad5af4d84c5126b3eec9f43583/e2e/lote-site.spec.ts#L18), com falha na asserção da linha 20.

**Evidência:** o [e2e (4) do #365](https://github.com/lucasgabrielberto0911-cloud/garagem-site/actions/runs/39849065821/job/120070058211) executou 122 casos: 108 passaram, 13 foram pulados e um falhou. O caso desktop “contato inicial de venda dispensa placa e mantém dados em erro” encontrou **dois** elementos `input#plate[name="plate"]` ao executar `expect(form.locator('[name="plate"]')).toBeHidden()`. Foi `strict mode violation`, não erro de validação da placa, de envio ou de banco. O caso terminou em 661 ms, antes de preencher ou enviar o formulário.

O teste e `src/app/(site)/vender/page.tsx` não foram alterados no #365. A página tem uma chamada a `SellForm` na linha 121; o componente declara um input de placa na linha 284, dentro de `details` na linha 277. A única mudança de `SellForm` nesse PR, linha 350, substitui a classe de hover do botão por `hover:bg-brand-dark`. Isso não demonstra uma duplicação permanente causada pelo patch visual.

O mesmo caso passou no shard 4 do CI do #362 (3,6 s) e do #363 (2,0 s), com o mesmo teste. Isso é indício de intermitência; não comprova sua causa. Streaming/hidratação é uma hipótese para a coexistência temporária de duas árvores, não um diagnóstico confirmado. Sem analisar o DOM/trace no instante da falha, não é possível afirmar se a duplicação era transitória ou um defeito persistente.

**Como corrigir:** reproduzir o caso isolado e em repetição na revisão do PR, registrando a quantidade de formulários/campos antes e depois da hidratação. Esperar explicitamente que exista um único formulário/campo com `toHaveCount(1)` antes da asserção de visibilidade permite aguardar uma duplicação transitória e ainda reprova duplicação persistente. Se houver mais de um formulário legítimo, tornar o formulário-alvo identificável e escopar o seletor. Se os campos duplicados persistirem, corrigir a renderização e manter a asserção de unicidade. Não substituir por `.first()`, não remover a asserção e não adicionar retries globais para ocultar o problema.

**Impacto × esforço:** médio × baixo para diagnóstico e sincronização explícita; esforço adicional depende de uma reprodução persistente.

### Baixa — `check` vermelho é consequência, não uma quarta causa

**Onde:** `.github/workflows/ci.yml:94` no histórico analisado.

**Evidência:** o job depende de `unit` e `e2e` e falha quando qualquer conclusão difere de `success`. O #364 tem audit reprovado e e2e cancelado; o #365 tem audit e um e2e reprovados.

**Como corrigir:** manter esse bloqueio. Ele deve ficar verde quando todos os jobs necessários passarem, sem mudança na lógica do `check`.

## Cuidados para a futura consolidação

A main observada nesta auditoria é `b6ec301a95653bcf698d3db482bab750c5e6d359`, posterior à base usada pelos quatro PRs. Ela já inclui #366 e #367; portanto, validar a consolidação contra a main atual, preservando essas alterações. O workflow atual também verifica `npx tsc --noEmit --project tsconfig.test.json` além dos tipos da aplicação.

O #363 contém `0a86f60` (regras admin) e `6e40d7d` (reaplicação do patch de segurança do #362). O #362 contém `d9994f1`, o patch original. Na consolidação, aplicar a correção de segurança uma única vez; não tratar esses dois commits equivalentes como mudanças independentes. As mudanças do #364 são quatro arquivos em `src/lib`; as do #365 são 18 arquivos de estilo/componentes e Tailwind. Esse inventário não substitui resolver conflitos e validar a combinação.

## Tarefas prontas para implementação

1. **Alta:** atualizar as branches #364/#365 com a correção de segurança já validada; aceitar somente audit crítico com código 0 após instalação limpa.
2. **Média:** reproduzir o caso de `lote-site` do #365 em desktop e repetição, verificar unicidade dos campos e corrigir a sincronização ou a renderização conforme a evidência; manter envio sem placa e preservação dos dados em erro.
3. **Média:** reexecutar o shard cancelado do #364; se a instalação voltar a travar, implementar limite de tempo por tentativa e nova tentativa controlada, mantendo os testes obrigatórios.
4. Confirmar CI completo verde nos dois PRs originais após as correções, conferindo os SHAs publicados. O status da Vercel com preview pulado não basta.
5. Em uma tarefa de implementação autorizada, criar `reserva/auditoria-consolidada` a partir da main atual; reunir os quatro conjuntos de alterações, deduplicando a correção de segurança. Rodar audit, testes completos, lint, ambos os type-checks, build e e2e em Postgres local isolado. Abrir Draft PR consolidado com as cinco seções e aguardar todos os jobs verdes. A abertura desse PR não faz parte desta subtarefa de auditoria.

## Validação e limites

Foram consultados os checks, conclusões individuais dos jobs, etapas puladas/canceladas, logs dos jobs relevantes e os diffs/fontes dos commits indicados. Os arquivos de log temporários ficam fora do commit. Nenhum arquivo de aplicação, workflow ou dependências foi alterado; nenhum PR foi aberto, fechado ou mesclado. Não houve acesso a banco de produção, mudança de envs da Vercel ou chamada a serviço pago.

Foi executado `npm ci` na branch de diagnóstico, baseada na main `b6ec301`, cujo `package.json` não difere do usado pelo #364. `npx prisma generate` terminou com sucesso. `npm ls next eslint-config-next --depth=0` confirmou ambas as versões 16.4.0; `npm audit --omit=dev --audit-level=critical` reproduziu a falha com código 1 e uma vulnerabilidade crítica. Isso reproduz o bloqueio de dependências da base, não equivale a executar os dois PRs completos. O log local é `/tmp/garagem-auditoria-ci-audit.log` nesta VM, fora do commit.

Uma sonda local do Playwright com DOM sintético, sem aplicativo ou banco, reproduziu a semântica do seletor: dois campos de placa ocultos fizeram `toBeHidden()` falhar por ambiguidade em 120 ms, apesar do timeout de 2 s. Após remover o segundo formulário com atraso de 150 ms, `toHaveCount(1)` seguido de `toBeHidden()` passou. Isso sustenta a recomendação de esperar unicidade, mas não prova a origem nem a duração da duplicação real no #365.

Os resultados remotos acima são evidência dos commits analisados, não uma nova execução das suítes nesta branch de relatório. Não foi reproduzido o travamento dos mirrors nesta VM, nem foi comprovada a origem da duplicação de DOM. Não foram lidos lockfile, `node_modules`, `.next` ou artefatos ZIP para esta análise.
