"use client";

import { useTransition } from "react";
import { btn } from "@/components/admin/ui";
import { useConfirmDialog } from "@/components/admin/useConfirmDialog";
import {
  getDeletePreparationDialog,
  getPreparationAnnouncementAriaLabel,
  getPreparationAnnouncementDialog,
  getPreparationAnnouncementMode,
} from "@/lib/preparation-confirm";
import {
  deletePreparationAction,
  markPreparationReadyAndMoveToStockAction,
  movePreparationToStockAction,
} from "./actions";

/**
 * Ações do carro em preparação: "Criar anúncio" em 1 clique (abre o
 * cadastro, que já exige foto e preço) e "Excluir" com confirmação.
 * Item pronto usa movePreparationToStockAction; item em preparo marca
 * como pronto antes de abrir o cadastro.
 */
export function PreparationItemActions({
  id,
  ready,
}: {
  id: string;
  ready: boolean;
}) {
  const [confirm, dialog] = useConfirmDialog();
  const [pending, startTransition] = useTransition();

  async function handleCreate() {
    if (!(await confirm(getPreparationAnnouncementDialog(ready)))) return;
    const form = new FormData();
    form.set("id", id);
    startTransition(async () => {
      if (getPreparationAnnouncementMode(ready) === "move-to-stock") {
        await movePreparationToStockAction(form);
      } else {
        await markPreparationReadyAndMoveToStockAction(form);
      }
    });
  }

  async function handleDelete() {
    if (!(await confirm(getDeletePreparationDialog()))) return;
    const form = new FormData();
    form.set("id", id);
    startTransition(async () => {
      await deletePreparationAction(form);
    });
  }

  return (
    <>
      {dialog}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCreate}
          disabled={pending}
          className={btn.primary}
          aria-label={getPreparationAnnouncementAriaLabel(ready)}
        >
          Criar anúncio
        </button>
        {!ready ? (
          <span className="w-full text-xs text-muted">
            Ainda em preparo. Vamos marcar como pronto e conferir fotos e
            preço.
          </span>
        ) : null}
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className={btn.danger}
          aria-label="Excluir este carro da lista"
        >
          Excluir
        </button>
      </div>
    </>
  );
}
