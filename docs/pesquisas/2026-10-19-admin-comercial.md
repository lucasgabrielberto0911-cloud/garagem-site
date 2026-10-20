# Admin comercial — funções 7 a 12

## Resumo

A aba **Operação** do veículo reúne sugestão de preço, reserva, avaliação do usado, financiamento e documentos. A Agenda recebe tarefas de pós-venda das vendas novas com cliente cadastrado. Textos adaptados de `admin-textos-minimax.md`, com a marca Garagem e sem preços nas mensagens de pós-venda.

## Fluxos e evidências

- `src/lib/admin-commercial.ts`: sugestão considera dias de estoque, FIPE, compra, custos e margem mínima em reais. Não sugere para consignados nem sem base de aquisição. O vendedor confirma a redução; o histórico mantém preço anterior e novo. A descrição continua sujeita à validação de preço existente.
- `src/app/admin/veiculos/commercial-actions.ts`: reserva exige cliente cadastrado, sinal e prazo em Brasília. Trava o veículo durante a transação; índice parcial impede duas reservas ativas. Cancelar não devolve dinheiro automaticamente. A venda aproveita cliente e sinal, sem somar o sinal novamente ao valor total.
- `src/lib/reservations.ts`: expiração preserva veículos vendidos, confere o estado depois da trava e libera até 100 reservas por execução. Painel visível verifica a cada minuto. O cron Vercel Hobby executa diariamente às 06h de Brasília; fora do painel, a liberação pode aguardar essa rotina. Cada mudança invalida o estoque e apenas os slugs afetados.
- `src/lib/after-sale.ts`: entrega, 7 dias (satisfação/Google), 30 dias (documentação) e 180 dias (revisão). Criação idempotente na transação da venda; edição reagenda só tarefas pendentes; exclusão da venda remove suas tarefas. Vendas sem cliente não geram tarefas. O vendedor abre a mensagem no WhatsApp e conclui a tarefa; não há envio automático.
- `src/components/admin/CommercialPanel.tsx`: 14 itens de entrada, estado pendente/OK/atenção/não se aplica, oferta e notas. Aprovar exige todos os itens avaliados e grava aquisição, chave e manual. Cadastre primeiro o anúncio, inclusive pelo cadastro rápido; fotos, custos e documentos usam os controles existentes da Operação. Avaliar não cria um segundo anúncio.
- `src/lib/admin-commercial.ts`: financiamento pela tabela Price, taxa mensal informada, prazo de 1 a 120 meses, entrada incluindo sinal, parcelas/juros/total. Sem IOF, seguros e tarifas: não é CET. Banco, cliente e situação ficam registrados; não há consulta ou aprovação bancária automática.
- `src/app/api/admin/documentos/[id]/route.ts`: PDFs autenticados, `private, no-store`, com Sora/Inter incorporadas e snapshot imutável no Postgres. Nenhum arquivo é publicado no Storage. Proposta e recibo de sinal têm cliente, veículo, valor, pagamento, condições e campos de assinatura. Recibo exige reserva do mesmo cliente e valor do sinal. Documentos são apoio comercial, sujeitos à revisão do modelo pelo responsável da loja.

## Implantação pendente

1. Revisar e aplicar `supabase/migrations/20261019000100_admin_comercial.sql` em ambiente isolado e, pelo responsável, antes de publicar o código. A migration adiciona cinco tabelas, índices, chaves, validações e RLS sem políticas públicas. As reservas antigas continuam sem prazo; precisam ser regularizadas pelo vendedor.
2. O cron exige `CRON_SECRET` configurado pelo responsável na Vercel. Nenhuma variável foi consultada ou alterada nesta tarefa. Sem essa configuração, a rota responde 401 e o painel continua verificando as reservas quando aberto.
3. Conferir o link Google em Dados do site. Sem link HTTPS, a mensagem omite o pedido com link. Revisar condições comerciais e modelo dos PDFs antes de uso com clientes.
4. Validar o preview após a migration. Produção e serviços externos não foram usados na validação local.

## Verificação

- Migration SQL executada somente no Postgres descartável em `127.0.0.1:5545/garagem_e2e`.
- Testes de regras: juros, taxa zero, entradas inválidas, piso de margem, FIPE, consignação, mensagens e PDF com acentos/paginação.
- E2E cobre as seis funções, privacidade do PDF, histórico de preço, expiração, vínculo de sinal com venda e pós-venda idempotente em 320, 390, 430 e 1440 px.
- Usar Node 22 para a suíte completa: o Supabase SDK instalado exige Node 22; com Node 20, o teste existente de galeria falha na inicialização do SDK.

## Prioridades após revisão

- Alta × baixa: aplicar migration coordenada com o deploy, configurar cron e revisar termos do documento.
- Média × média: se houver exigência de liberação de reservas em minuto exato sem painel aberto, substituir o cron diário por agendador com frequência de minuto e invalidar os mesmos caches.
