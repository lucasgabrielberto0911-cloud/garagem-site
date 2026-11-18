/**
 * Textos e decisão das ações de "Em preparação".
 * Criar anúncio abre o cadastro (/admin/veiculos/novo?prep=...), que já
 * exige foto e preço válidos antes de salvar no estoque.
 */

export const DELETE_PREPARATION_CONFIRM_MESSAGE =
  "Excluir este carro da lista Em preparação? Não dá para desfazer.";

export type PreparationAnnouncementMode = "move-to-stock" | "mark-ready-and-move";

/** Decide qual caminho o botão "Criar anúncio" segue, conforme o pronto. */
export function getPreparationAnnouncementMode(
  ready: boolean,
): PreparationAnnouncementMode {
  return ready ? "move-to-stock" : "mark-ready-and-move";
}

export function createAnnouncementConfirmMessage(ready: boolean): string {
  const dialog = getPreparationAnnouncementDialog(ready);
  return `${dialog.title} ${dialog.description}`;
}

export function createAnnouncementHref(prepId: string): string {
  return `/admin/veiculos/novo?prep=${encodeURIComponent(prepId)}`;
}

export function getPreparationAnnouncementDialog(ready: boolean): {
  title: string;
  description: string;
  confirmLabel: string;
} {
  if (ready) {
    return {
      title: "Criar o anúncio deste carro?",
      description: "Confira fotos e preço na próxima tela.",
      confirmLabel: "Criar anúncio",
    };
  }
  return {
    title: "Marcar como pronto e criar o anúncio?",
    description:
      "Este carro ainda não está marcado como pronto. Vamos marcar como pronto e abrir o cadastro. Confira fotos e preço na próxima tela.",
    confirmLabel: "Marcar como pronto e continuar",
  };
}

export function getPreparationAnnouncementAriaLabel(ready: boolean): string {
  return ready
    ? "Criar anúncio deste carro"
    : "Marcar como pronto e criar anúncio deste carro";
}

export function getDeletePreparationDialog(): {
  title: string;
  description: string;
  confirmLabel: string;
  danger: true;
} {
  return {
    title: "Excluir este carro?",
    description: DELETE_PREPARATION_CONFIRM_MESSAGE,
    confirmLabel: "Excluir",
    danger: true,
  };
}
