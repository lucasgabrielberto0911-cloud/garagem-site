# Painel: implementação do plano auditado

Base: main f43f97e. Sem alteração dos cards públicos e sem alteração de dados da loja.

## Publicação

Este PR inclui novas tabelas privadas, dois campos de atendimento e a revisão de vendas. **Antes de colocar este código em produção**, revisar e aplicar `prisma/sql/admin-workspace-v2.sql`. O SQL é aditivo e não altera valores de preços, compra, custos ou vendas. Depois, revisar/aplicar `prisma/sql/admin-access-hardening.sql` para restringir as operações públicas e conferir novamente os advisors. Os SQLs ainda não foram executados em produção.

O armazenamento `documentos` foi conferido como privado e limitado a 12 MB; `veiculos` é público para exibição. Os arquivos internos passam por URL assinada, evitando enviar 12 MB pela função Vercel. A chave privilegiada permanece somente no servidor. Não alterar a privacidade dos buckets como parte do deploy.

Sessões antigas precisarão de novo login no primeiro deploy. A troca de senha/e-mail revoga as impressões anteriores; a sessão atual é reemitida após a troca de senha. O limite compartilhado usa a tabela privada. Se ela ainda não existe/está indisponível, há fallback Upstash ou local para não derrubar o acesso; aplicar o SQL é requisito para o limite compartilhado entre instâncias.

## Cobertura do plano

- Login seguro desde o HTML inicial; verificação da existência do admin e revogação ao trocar senha.
- Limpeza com prévia, confirmação, 48 horas de proteção, referências de todas as áreas, rascunhos privados e bloqueio transacional comum entre limpeza e gravação de referências.
- Salvamento do anúncio com controles congelados, revisões contra sobrescrita, retorno de erros e aviso móvel. Operação com fila ordenada, reenvio e confirmação persistente.
- Cadastro em seções curtas, resumo e rascunho privado por conta, com expiração em 30 dias. Consultas FIPE/placa exigem confirmação antes de substituir dados preenchidos.
- Fila de fotos única, resultados imediatos, pausa de itens ainda na fila, recuperação local de arquivos e identificadores estáveis para reenvio. Decodificação sequencial limita memória. HEIC de até 3 MB passa pelo conversor existente; para maiores, a orientação de exportar JPG permanece explícita. Nenhuma qualidade/limite foi prometida sem suporte.
- Operação financeira antes do acervo, zoom no borrão manual, controle de foco em menu/editor e mensagens associadas aos campos. Barra de salvar do site acima da navegação, conteúdo recolhível e uploads coordenados com salvar.
- Busca de clientes corrigida e prevenção de duplicação por telefone/CPF. Totais completos do período, centavos, compra obrigatória para lucro apurado, filtro sempre visível e CSV consistente com snapshot do filtro. Exportações acima de 10 mil registros pedem reduzir o filtro, nunca truncam silenciosamente.
- Dashboard com falha distinta de zero, atualização explícita, total e amostra de pendências separados, evolução mensal real, atalho para registrar uma venda pendente e para retomar um atendimento.
- Histórico manual de contato e próxima ação. Não há disparo automático de mensagens.
- Auditoria privada de cadastro/edição de anúncio e registro/edição financeira de venda. Não salva senha, documento ou dados de contato.
- Layout não espera uma consulta de badge antes de apresentar a tela. Consultas sem uso removidas; componentes mantêm carregamento separado. Sem promessa de ganho de TTFB remoto: não houve evidência de gargalo de banco no histórico pequeno.

## Limites e sequência condicionada

Permissões por função, recuperação por e-mail e segundo fator estavam no plano como avaliações condicionadas à equipe/provedor. Não foram ativados sem definir quem usa cada função e sem provedor de recuperação. A revogação e o controle de sessão previstos foram implementados. Backups e políticas de retenção da plataforma precisam ser definidos separadamente; não foram alterados por este PR.

Não foram corrigidos automaticamente os dois veículos vendidos sem registro financeiro nem a venda de R$ 10 encontrada na auditoria. O painel oferece caminhos e avisos para conferência humana. Não foram criadas vendas, avaliações nem valores em produção.

## Validação realizada

- Build de produção passou. 474 testes automatizados passaram. Lint sem erros, com cinco avisos preexistentes em `catalog-feed-http.ts`.
- PostgreSQL descartável: 95 vendas, busca de clientes, totais completos e centavos, limite de login concorrente, locks de arquivos/clientes, conflito sem perda de fotos e rascunho sem publicação.
- Os dois SQLs foram aplicados duas vezes sobre uma cópia do esquema inicial com dados sintéticos: preservaram valores monetários, preencheram a revisão de vendas, restringiram acesso anônimo e mantiveram a leitura das fotos públicas.
- Chromium e WebKit: onze áreas do painel em emulação móvel, verificações de largura em 320/360/430 pixels e revisão de desktop. Nenhuma exceção JavaScript nas telas. O aviso de hidratação preexistente do bootstrap público (`garagem-booted`) continua separado deste trabalho.
- Fluxos reais no ambiente local: sessão expirada mantém campos, troca de senha revoga outra sessão, rascunho retorna após recarga, fila de fotos aceita novas imagens durante envio e recupera falhas, limpeza reconfere vínculos surgidos após a prévia, autosave recupera falha e mantém a última versão, criação/edição/cancelamento de venda atualizam estoque e histórico, atendimento funciona sem fotos e CSV inclui todos os 95 registros. Lucro negativo continua numérico; textos externos recebem proteção contra fórmulas.
- Arquivo privado de 5 MB foi enviado por URL assinada ao Storage de teste, com tamanho armazenado e referência no banco conferidos. Não houve upload de teste na loja.
- Cadastro e edição mantêm os centavos ao salvar um preço existente ou novo, sem perder fotos. As barras de salvar de cadastro, edição e Dados do site ficaram acima da navegação em toda a rolagem, inclusive na área visível de 390 × 664 pixels.

Dados sintéticos identificados como teste. Teclado/gestos em aparelho físico e integração final do Storage real após publicação continuam a conferir. O teste local não mede latência de produção nem substitui essa conferência final.

Referências dos advisors: [RLS desabilitada](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public) e [função SECURITY DEFINER exposta](https://supabase.com/docs/guides/database/database-linter?lint=0028_function_security_definer_exposed).
