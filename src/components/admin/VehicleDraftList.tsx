"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useConfirmDialog } from "@/components/admin/useConfirmDialog";
import { btn } from "@/components/admin/ui";
import { vehicleDraftHref } from "@/lib/vehicle-draft-fields";

type Draft = {
  key: string;
  title: string;
  updatedAt: string;
  preparationId: string | null;
};

export function VehicleDraftList({ adminId }: { adminId: string }) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, dialog] = useConfirmDialog();

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/drafts?prefix=vehicle:new", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        setDrafts(data.drafts);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Não foi possível consultar os rascunhos. Recarregue a página para tentar novamente.",
          );
      });
    return () => controller.abort();
  }, []);

  async function discard(draft: Draft) {
    if (
      !(await confirm({
        title: "Descartar rascunho?",
        description: draft.title,
        confirmLabel: "Descartar",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/drafts?key=${encodeURIComponent(draft.key)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error();
      const storageKey = `garagem:vehicle-draft:${adminId}:${draft.key.slice("vehicle:".length)}`;
      try {
        localStorage.removeItem(storageKey);
        sessionStorage.removeItem(storageKey);
      } catch {
        /* O servidor já descartou o rascunho. */
      }
      setDrafts((current) => current!.filter((item) => item.key !== draft.key));
    } catch {
      setError("Não foi possível descartar o rascunho. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {dialog}
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
      {!drafts && !error ? (
        <p role="status" className="text-sm text-muted">
          Carregando rascunhos…
        </p>
      ) : null}
      {drafts?.length === 0 ? (
        <p className="text-sm text-muted">Nenhum rascunho guardado.</p>
      ) : null}
      <ul className="divide-y divide-white/10">
        {drafts?.map((draft) => (
          <li
            key={draft.key}
            className="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm text-cream">{draft.title}</p>
              <time dateTime={draft.updatedAt} className="text-xs text-muted">
                {new Date(draft.updatedAt).toLocaleString("pt-BR")}
              </time>
            </div>
            <div className="flex gap-1">
              <Link
                className={btn.ghost}
                href={vehicleDraftHref(draft.key, draft.preparationId)}
              >
                Continuar
              </Link>
              <button
                type="button"
                className={btn.ghost}
                disabled={busy}
                onClick={() => discard(draft)}
              >
                Descartar
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Link href="/admin/veiculos" className={btn.ghost}>
        Voltar aos veículos
      </Link>
    </>
  );
}
