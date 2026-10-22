# Investigação do admin — checkpoint de pausa

Tarefa: `10221930cf1a-1`. Estado: **pausada por solicitação expressa do Lucas**, aguardando os merges dos PRs consolidados. Não retomar automaticamente.

## Branch e progresso

- Worktree: `/home/lucas/wt/codex`.
- Branch: `reserva/10221930cf1a-1-investigar-apis-admin-listagem`.
- Base inicial: `b6ec301a95653bcf698d3db482bab750c5e6d359` de `origin/main`.
- Nenhuma correção de aplicação foi implementada nesta tarefa. Nenhum PR foi aberto, conforme sua instrução final. Nenhuma alteração de banco, produção, configuração ou variáveis da Vercel foi realizada.
- Não há causa raiz confirmada nem validação de correção. A pausa ocorreu durante a coleta inicial de evidências, antes de reproduzir os problemas localmente.

## Evidências já consultadas

- Tarefa original: `/home/lucas/tasks/10221930cf1a-1-codex.md`.
- Captura inspecionada: `/home/lucas/orq/uploads/10221930cf1a/1-c1792708230-1.png`. Ela mostra o toast “Não foi possível registrar a venda.” junto do modal “Marcar como vendida (simples)”. A imagem, isoladamente, não comprova que uma falha de venda completa abriu esse modal.
- Os caminhos reais encontrados incluem `src/app/api/admin/vehicles/[id]/sell/route.ts`, `src/app/admin/veiculos/[id]/page.tsx`, `src/components/admin/VehiclesTable.tsx` e as Server Actions em `src/app/admin/vendas/actions.ts`. Não presumir os endpoints em português ou retorno HTTP 201 mencionados no roteiro: é necessário seguir os chamadores reais.
- O PATCH trata as modalidades simples/completa, usa transação e converte erros desconhecidos em mensagem genérica. A causa desse erro ainda não foi identificada.
- A página de edição consulta veículo e dados auxiliares; `getStoredListingScore` já captura falhas da leitura de nota e retorna `null`. Não foi demonstrado que essa consulta impede abrir o anúncio.
- Foram lidos os auxiliares de pós-venda e revalidação. Não foi comprovado defeito neles. Não presumir falha de schema, cache ou de modal sem reprodução/evidência adicional.

## Acesso remoto e registros preservados

- O projeto da Vercel foi confirmado por leitura como `lm13/garagem-site`, ID `prj_CwarUN9OgDG32N7nJ10FPASuv669`.
- O plugin Vercel retornou 403 de autorização para esse escopo. O CLI já autenticado conseguiu inspecionar o projeto.
- A consulta de runtime logs pelo CLI, solicitando 24 horas, foi rejeitada pela retenção do plano Hobby. **Não foram obtidos erros de runtime nessa consulta; isso não demonstra ausência de erros.**
- Arquivos locais, fora do commit: `/tmp/garagem-admin-runtime-24h.jsonl` e `/tmp/garagem-admin-runtime-24h.stderr`. O stderr registra a rejeição de retenção. Não coletar novamente enquanto a tarefa permanecer pausada.
- O plugin Supabase reconheceu o projeto `garagem-site` (`vesmqhyxautgtvgccweo`, região `sa-east-1`). Foram feitas apenas consultas de leitura do fluxo de logs, sem consultar ou alterar registros de negócio.
- Janela efetivamente consultada no Supabase: de `2026-10-21T22:00:00Z` a `2026-10-22T22:00:00Z`. Contagens retornadas: edge 46.634; supavisor 2.485; pgbouncer 2.154; storage 731; postgres 46. Essas contagens não distinguem sucesso de erro e a janela não cobre ocorrências posteriores às 22:00 UTC.
- A leitura de nomes de atributos de Postgres mostrou `parsed.error_severity` e `parsed.sql_state_code`. A tentativa de consultar também a coluna `message` foi rejeitada porque ela não existe nessa interface. Nenhum erro específico de Postgres foi identificado. Não repetir consultas por tentativa e erro; confirmar o formato do fluxo ao retomar.
- As respostas resumidas e os nomes de atributos também estão no histórico da sessão. Nenhum dado de cliente, credencial, token ou URL de banco foi incluído neste checkpoint.

## Retomada, somente após autorização

1. Confirmar os merges consolidados e atualizar a base de trabalho preservando esta branch e seu checkpoint; conferir também PRs abertos da área admin.
2. Revalidar os sintomas na versão resultante dos merges, pois os commits podem alterar o comportamento observado.
3. Consultar logs disponíveis dentro da retenção gratuita e correlacionar horário, rota e erro; não registrar dados pessoais ou segredos no repositório.
4. Reproduzir abertura de edição, venda completa e venda simples em Postgres local isolado. Não criar vendas nem fazer experimentos no banco de produção.
5. Só então aplicar a correção mínima, cobrir os cenários afetados e executar as verificações previstas na tarefa. Manter o formato sem PR, salvo nova orientação do orquestrador.

## Validação deste checkpoint

Somente documentação. Não foram iniciados testes, builds ou novas consultas para concluir o checkpoint da pausa. O diagnóstico e os critérios funcionais da tarefa permanecem pendentes.
