# Prévias das fotos antigas

O comando é somente leitura por padrão: `npm run photos:gallery-backfill -- --limit=20`.
Ele seleciona fotos de veículos disponíveis, sem tocar em vendidos, históricos, cards ou masters privados.
Exige as credenciais de servidor do banco e do Storage; nunca as envie ao navegador.

Para aplicar o lote: `npm run photos:gallery-backfill -- --apply --limit=20`.
A saída informa `after`: use `--after=ID` para continuar o próximo lote. Caminhos já preparados não são selecionados de novo.
Não executar em build, CI ou deploy. Começar com um lote pequeno e conferir ficha, admin, fotos e feed antes de continuar.

A galeria é copiada byte por byte para um nome novo com `-g800`; a prévia é WebP de até 800 px, q80, sem ampliar fotos pequenas. O original e seus links continuam disponíveis. O site já reconhece este nome desde o PR #213. Não usa o otimizador da Vercel, nova configuração paga ou limite de MB de upload.

Objetos são imutáveis (`upsert: false`): retomadas aceitam somente conteúdo idêntico. A URL no banco muda apenas depois dos dois uploads e do registro de recuperação, e só se ninguém editou aquela foto durante o lote. Uma falha mantém o anúncio usando a URL anterior. Originais, miniaturas e masters não são apagados.

O relatório JSONL permite desfazer exclusivamente as URLs que ainda correspondam ao lote:
`npm run photos:gallery-backfill -- --rollback=artifacts/RELATORIO.jsonl` mostra a prévia;
acrescentar `--apply` para restaurar. Fotos editadas depois do lote são preservadas.
Não há limpeza automática de arquivos; cópias preparadas ficam disponíveis para uma retomada.

O site pode manter o conteúdo anterior até a revalidação dos caches. Conferir a ficha após a revalidação ou o próximo deploy, sem substituir arquivos por baixo de URLs com cache imutável.
