# Simplificação da postagem de anúncios no admin

## Resumo

Inspeção do código em 04/11/2026, base `14b7895`. Os recursos principais pedidos já existem. Não há PR aberto retornado por `gh pr list` nesta consulta. Nenhum dado de produção ou foto foi acessado.

Lucas autorizou em 04/11 a implementação e a abertura de PR rascunho como exceção ao AGENTS.md. A tabela abaixo registra os recursos que já existiam antes desta tarefa.

## O que já existe

| Pedido | Evidência e comportamento atual |
| --- | --- |
| Dados pela FIPE, sem consulta por placa | `src/components/admin/vehicle-form/FipeFields.tsx:11` preenche marca, modelo, versão, ano modelo e combustível. `src/lib/fipe.ts:27` aceita apenas os parâmetros da consulta FIPE; placa é rejeitada. Fabricação, cor e demais dados próprios do exemplar continuam manuais. |
| Referência de preço FIPE e estoque parecido | `src/components/admin/vehicle-form/FipeFields.tsx:25` apresenta FIPE, quantidade, faixa e média do estoque comparável. O preço só muda pelo botão de aplicação. `src/app/api/admin/fipe/route.ts:10` agrega veículos ativos do mesmo modelo/ano, excluindo o anúncio em edição; falha do agregado não bloqueia a FIPE. |
| Conferência antes de publicar | `src/components/admin/vehicle-form/VehicleFormSummary.tsx:46` exibe qualidade e prévia na etapa final. `src/components/admin/PublishChecklist.tsx:100` permite ir diretamente ao campo pendente. `src/components/admin/vehicle-form/VehicleForm.tsx:90` valida antes de enviar. |
| Duplicação | `src/app/admin/veiculos/actions.ts:828` cria rascunho sem fotos, placa, km, preço e outros dados do exemplar. Rascunho existente exige confirmação e tem cópia de segurança. A ação está disponível no menu da lista. |
| Ações em lote | `src/components/admin/VehiclesTable.tsx:499` controla seleção limitada; a lista oferece atualização de status e destaque, com confirmação e tratamento de erros. |
| Busca e filtros | `src/components/admin/VehiclesTable.tsx:318` mantém busca, abas, status e pendências na URL. A lista permite ordenar e carregar mais resultados. |
| Painel mais leve | `src/lib/admin-vehicles.ts:267` pagina e executa contagem/consulta em paralelo; tamanho padrão de 20. Estatísticas têm cache de 60 segundos em `src/lib/admin-vehicles.ts:530`. A edição consulta custos, documentos e informações verificadas apenas nas abas correspondentes em `src/app/admin/veiculos/[id]/page.tsx:59`. Editores de imagem são carregados sob demanda. |
| Edição por etapas e Salvar visível | `src/components/admin/vehicle-form/EditLayout.tsx:73` mantém navegação entre quatro etapas; botão de envio em todas elas em `:137`. `src/components/admin/VehicleFormFooter.tsx:27` fixa o rodapé e mede sua altura para reservar espaço no formulário. |

## Implementado nesta tarefa

- **P1 — lista consistente e menos trabalho descartado:** `src/components/admin/VehiclesTable.tsx` cancela a requisição anterior ao substituir a lista, ignora respostas e erros cancelados e só encerra o carregamento da requisição atual. Também cancela consultas ao sair da tela. Isso alcança ordenação, paginação e atualizações da lista após ações.
- **P2 — FIPE mais fácil de encontrar:** `src/components/admin/vehicle-form/sections/IdentitySection.tsx` apresenta a consulta antes dos campos de identificação e explica que ela não usa a placa. A consulta automática continua exclusivamente pela FIPE. A edição manual continua disponível para correções e indisponibilidade da tabela, preservando funções existentes.
- **P2 — aplicar referência do estoque:** `src/components/admin/vehicle-form/FipeFields.tsx` permite aplicar a média dos anúncios semelhantes ao preço. FIPE e estoque têm botões separados; nenhum preço muda sem escolha explícita. Mudanças nos dados do veículo invalidam ambas as referências, como antes.
- **Regressões:** `e2e/admin-lista-lote.spec.ts` cobre requisições concorrentes e cancelamento com respostas simuladas; `e2e/admin-fipe.spec.ts` cobre aplicação da média, invalidação e Salvar visível nas quatro etapas.

Não foram adicionadas dependências ou migrações. Nenhuma alteração em tela pública, depoimentos ou arquivos de ambiente.

## Validação desta implementação

- `npm test`: 1.704 aprovados, zero falhas (133 s). Executado sem `E2E_TEST`, com fetch simulado nos testes de imagens.
- `npm run lint`: aprovado; ESLint dos arquivos alterados também aprovado após os ajustes finais dos testes.
- `npm run build`: aprovado com banco local acessível, sem falhas de geração estática.
- E2E focado: 32 aprovados (1,4 min), nas larguras 320, 390, 430 e 1440 px: `npx playwright test e2e/admin-fipe.spec.ts e2e/admin-lista-lote.spec.ts`. Banco local dedicado, consultas FIPE simuladas e dados sintéticos criados/removidos por fixture. Rodapé e Salvar conferidos nas quatro etapas em cada largura; screenshot da etapa de preço revisado em 390 px.
- `DATABASE_URL` e `DIRECT_URL` apontaram exclusivamente para `127.0.0.1:5432/garagem_e2e` no ambiente dos processos. Nos E2E, `E2E_TEST=1` e notificações/credenciais do Storage desativadas. Nenhum arquivo `.env` foi editado.

## Limites e próximos passos

- Não há medição de ganho em milissegundos; a melhoria de desempenho elimina trabalho e atualizações obsoletas no navegador. Paginação, cache e consultas paralelas já existiam.
- Preview da Vercel não solicitado. Publicação e merge ficam com o coordenador.
