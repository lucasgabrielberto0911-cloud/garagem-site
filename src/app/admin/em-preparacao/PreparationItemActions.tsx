"use client";

import Link from "next/link";
import { btn } from "@/components/admin/ui";
import {
  createAnnouncementConfirmMessage,
  createAnnouncementHref,
  DELETE_PREPARATION_CONFIRM_MESSAGE,
} from "@/lib/preparation-confirm";
import { deletePreparationAction } from "./actions";

/**
 * Ações do carro em preparação: "Criar anúncio" em 1 clique (abre o
 * cadastro, que já exige foto e preço) e "Excluir" com confirmação.
 */
export function PreparationItemActions({
  id,
  ready,
}: {
  id: string;
  ready: boolean;
}) {
  const handleCreateClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!window.confirm(createAnnouncementConfirmMessage(ready))) {
      event.preventDefault();
    }
  };

  const handleDeleteSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm(DELETE_PREPARATION_CONFIRM_MESSAGE)) {
      event.preventDefault();
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Link
        href={createAnnouncementHref(id)}
        onClick={handleCreateClick}
        className={btn.primary}
        aria-label={
          ready
            ? "Criar anúncio deste carro"
            : "Criar anúncio deste carro mesmo sem estar pronto"
        }
      >
        Criar anúncio
      </Link>
      {!ready ? (
        <span className="w-full text-xs text-muted">
          Ainda em preparo. Dá para abrir o anúncio e conferir fotos e preço.
        </span>
      ) : null}
      <form action={deletePreparationAction} onSubmit={handleDeleteSubmit}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" className={btn.danger} aria-label="Excluir este carro da lista">
          Excluir
        </button>
      </form>
    </div>
  );
}
