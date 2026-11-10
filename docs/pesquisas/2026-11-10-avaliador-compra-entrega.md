# Avaliador de compra — implementação dos PRs 1–4

Entrega privada em `/admin/compra`, continuando a worktree `reserva/admin-compra` na base `7566b56` (#446). A autorização desta continuação permite ao Codex implementar o trabalho interrompido. Não houve SQL, seed, alteração de ambiente ou download de fotos de produção.

## Comportamento e limites

- Descrição e preço pedido permitem salvar rascunho. Identidade, custos e evidências incompletos aparecem como pendências; salvar não cria veículo, compra, venda ou custo.
- Versão, ano-modelo, combustível e câmbio exigem confirmação humana. A placa serve à identificação privada e à busca exata nos registros internos. Havendo várias origens, o operador escolhe; o DTO exclui nomes, telefones, documentos e fotos. Carregar uma origem não a modifica.
- Revenda é informada como venda efetiva **futura** de cada cenário. O motor não desconta negociação ou depreciação novamente. Anúncio de origem e anúncio pretendido são campos separados.
- Não há estimativa automática de ágio, consulta às vendas para inferir médias, pesquisa de mercado, IA, revisão de legendas ou financiamento. A hipótese manual registra fonte, data e confirmação do operador. FIPE não gera prêmio por marca/modelo e não define teto de revenda.
- O histórico FIPE informa variações com os meses exatos de 3/6/12/24 meses. Não projeta valorização automaticamente nem inventa meses faltantes.

## Premissas provisórias

`src/lib/purchase-policy.ts` publica a versão `2026-11-provisorio-1`. São hipóteses para validação operacional, não médias observadas da Garagem:

| Parâmetro | Padrão |
| --- | --- |
| Cenários | 30 / 60 / 90 dias |
| Meta | R$ 6.000 em cada cenário |
| Comissão/taxas comerciais sobre venda | 2%, editáveis; não representam regra fiscal |
| Capital simples | 1% ao mês, editável |
| Permanência | R$ 10 por dia, editável |
| Preparação leve ilustrativa | R$ 1.200, discriminada e editável |
| Reserva de garantia ilustrativa | R$ 300 base / R$ 600 adversa; não é garantia jurídica |
| Custo desconhecido | Reserva por item de R$ 300 base / R$ 1.000 adversa e bloqueio de recomendação favorável |
| Preço ideal | Menor teto dos cenários − R$ 1.000; arredondado para baixo em passos de R$ 500 |
| Rubrica | Financeiro 45, liquidez 20, condição 20, documentação 10, completude 5 |
| Liquidez | Mediana verificada, ao menos 5 vendas e amostra efetiva ≥ 3; sem esses dados a dimensão fica aberta |
| Frescor da evidência manual | Revenda até 30 dias; liquidez até 365 dias |

Metas, taxas, folga, passo e permanência podem mudar por avaliação. O snapshot armazena os valores efetivamente usados, a política publicada (se houver), as versões do motor e da rubrica. Custos desconhecidos não são zero; custos dispensados/zerados exigem justificativa. Orçamento e histórico exigem data e identificação da fonte. Mecânica desconhecida ou problema grave sem diagnóstico bloqueiam recomendação.

Dinheiro usa centavos inteiros e divisões racionais com `BigInt` internamente. Taxas aceitam até oito casas decimais; despesas arredondam para cima e tetos para baixo. O retorno sobre capital exibe o denominador, excluindo reservas não desembolsadas e permanência futura. Resultado é contribuição estimada após os custos configurados, não lucro líquido contábil. Preço fixo não recebe desconto fictício nem penalidade adicional.

## Persistência, autorização e cache

Tabelas aditivas: `PurchaseEvaluation`, `PurchaseEvaluationRevision`, `FipeMonthlyPrice`, `VehicleFipeIdentity`, `VehicleAcquisitionMetadata`, `PurchasePolicyVersion` e `FipeHistoryCache`. Identidade FIPE e metadados de aquisição ficam disponíveis para confirmações futuras, sem preenchimento em massa.

**Modelo enxuto do MVP:** evidências ficam em JSON versionado na revisão, junto de entrada validada, FIPE, política, saída financeira e nota. Não foi criada `PurchaseEvidence`: os IDs usados na rubrica apontam para esses blocos e os cenários do snapshot. Não há tabela de execuções de IA nesta entrega. Payloads são limitados a 64 KB e até 40 custos; listagens retornam 20 avaliações por página e a reabertura inclui as últimas 20 revisões.

Todas as entradas de servidor verificam `getSession`; avaliação pertence ao criador. Acesso cruzado retorna 404. POST exige `Origin` da aplicação. Respostas das APIs usam `Cache-Control: private, no-store`, inclusive o bloqueio de sessão no proxy por configuração específica de headers. Cookies mantêm o login próprio existente; não há Supabase Auth.

Salvar recalcula no servidor, descarta totais do navegador e grava revisão, auditoria sem PII e chave de idempotência na mesma transação. `expectedVersion` impede sobrescrita concorrente (409); uma chave repetida com entrada diferente também retorna 409. Triggers impedem UPDATE/DELETE de revisões e de políticas publicadas. Não há API de exclusão de snapshots.

RLS está habilitado em todas as tabelas novas, com privilégios revogados de `PUBLIC`, `anon` e `authenticated`. O Prisma continua privilegiado; a autorização por criador ocorre no backend. A migration não modifica tabelas ou dados de estoque. O rollback recusa eliminar avaliações, políticas ou metadados preenchidos: desligar a flag é o rollback operacional preferido.

Não há `unstable_cache`, tag pública, `updateTag` ou invalidação de estoque no módulo. O item Compra foi inserido depois dos três primeiros itens de `NAV`, preservando a navegação inferior baseada em `slice`.

## FIPE histórico

O cadastro Parallelum e o contrato de `fetchFipe` permanecem intactos. O adaptador independente usa [a API documentada do tabelafipe.info](https://tabelafipe.info/api-tabela-fipe), com atribuição na tela. A consulta usa POST privado em `/api/admin/fipe-historico` para manter descrição e decisão humana fora de URLs de acesso; o backend monta apenas endpoints fixos com campos permitidos.

- Match apenas apresenta candidatos; não escolhe o primeiro. Empate EX/EXL não resolve identidade.
- String numérica em `value_cents` é aceita; negativos, decimais, notação científica textual, tipos inesperados e overflow são rejeitados.
- `referenceMonth` é `YYYY-MM`; também aceita a data ISO estrita observada em `/referencia`.
- Combustível bruto divergente permanece visível e exige decisão humana. Versão/ano divergentes são rejeitados.
- Cache persistente da referência por 24 h, ficha por identidade/referência e candidatos por 24 h. Cache negativo por 60 s, lease compartilhado de 10 s, timeout total da chamada de 8 s e uma retentativa de 5xx com jitter.
- Orçamento compartilhado de 30 chamadas/minuto e 60 solicitações/minuto por admin, usando o contador existente no Postgres. Não há fallback em memória para essa proteção. O orçamento do módulo não controla outros serviços na mesma saída de rede.
- 429 respeita `Retry-After` em cooldown persistente entre instâncias e não repete em loop. Falha pode usar snapshot anterior válido com data/aviso; sem snapshot, permanece disponível a referência manual não verificada.
- A série deduplica o mês atual, rejeita preços incompatíveis no mesmo mês e preserva lacunas. Vinte e quatro pontos incluindo o atual não fornecem necessariamente a variação de 24 meses.

## Flags e ativação

`PURCHASE_EVALUATOR_ENABLED` e `PURCHASE_FIPE_HISTORY_ENABLED` ficam **desligadas por padrão**. Aceitam `1`, `true` ou `on`. Não foram configuradas na Vercel. Pesquisa/IA/revisão de texto não têm implementação ativável nesta entrega.

A preparação operacional deve ocorrer separadamente: aplicar a migration aditiva no ambiente autorizado, conferir estrutura e permissões e só então habilitar o avaliador para o operador piloto. Histórico externo exige sua própria flag. Se a flag ou alguma tabela faltar, o módulo mostra indisponibilidade; cadastro, vendas e Assistente não importam esse serviço.

## Validação

Banco local descartável, isolado em `127.0.0.1:55436`; nenhum segredo ou banco de produção usado. O CI aplica a migration do avaliador no Postgres E2E antes dos testes para exercitar os mesmos triggers. As flags são habilitadas somente no servidor de testes, com histórico externo desligado.

- Fixture numérica do plano: resultados R$ 8.830 / R$ 9.890 / R$ 4.580; tetos R$ 62.801,98 / R$ 63.813,72 / R$ 58.621,35; ideal R$ 57.500.
- Testes de monotonicidade, teto/centavo acima, equilíbrio, arredondamento racional, modo fixo, desconhecidos, notas em intervalo, evidência vencida, gates de risco e validação de valores.
- Parsers e serviço FIPE: string em centavos, EX/EXL empatados, combustível divergente, meses exatos, 24 pontos/23 intervalos, cache, lease, budget e cooldown compartilhado.
- Segurança HTTP: sessão, flag, schema ausente, origem obrigatória, 429, MIME/JSON e tamanho do corpo.
- Evolução a partir do schema de `7566b56`, migration nova aplicada duas vezes e diff Prisma vazio. Todas as 26 migrations aplicadas duas vezes no schema atual. Rollback vazio aplicado duas vezes.
- Jornada E2E em 320, 390, 430 e 1440 px: somente admins, leads e avaliações fictícias. Nenhum veículo de teste é criado; contagens de veículo/venda/custo permanecem iguais. Sem downloads de fotos.

Os resultados finais dos comandos e do E2E constam no draft PR. Não houve medição de Lighthouse porque nenhuma tela pública foi alterada.

Referências para revisão: motor em `src/lib/purchase-simulator.ts:16`; rubrica em `src/lib/purchase-score.ts:10`; autorização e gravação em `src/lib/purchase-store.ts:52` e `:63`; serviço FIPE em `src/lib/fipe-history-store.ts:76`; RLS em `supabase/migrations/20261110150000_avaliador_de_compra.sql:158`; E2E em `e2e/admin-compra.spec.ts:40` e `:78`.

## Próximas tarefas, fora deste PR

1. P0: validar metas, enquadramento fiscal, reservas e rubrica com a operação antes de ativar (impacto alto, esforço médio).
2. P1: auditar vendas/custos completos e confirmar identidades FIPE antes de inferir prêmio ou liquidez automaticamente (impacto alto, esforço alto).
3. P1: pesquisa, análise por IA e revisão de legendas nos PRs 5–7, com orçamento, autorização e evidências próprios (impacto médio, esforço alto).
4. P2: calibrar estimado versus realizado e ampliar a navegação de revisões além das últimas 20 quando o uso justificar (impacto médio, esforço médio).
