/**
 * Textos e links das ações de "Em preparação".
 * Criar anúncio abre o cadastro (/admin/veiculos/novo?prep=...), que já
 * exige foto e preço válidos antes de salvar no estoque.
 */

export const DELETE_PREPARATION_CONFIRM_MESSAGE =
  "Excluir este carro da lista Em preparação? Não dá para desfazer.";

export function createAnnouncementConfirmMessage(ready: boolean): string {
  return ready
    ? "Criar o anúncio deste carro? Confira fotos e preço na próxima tela."
    : "Este carro ainda não está marcado como pronto. Abrir o anúncio mesmo assim? Confira fotos e preço na próxima tela.";
}

export function createAnnouncementHref(prepId: string): string {
  return `/admin/veiculos/novo?prep=${encodeURIComponent(prepId)}`;
}
