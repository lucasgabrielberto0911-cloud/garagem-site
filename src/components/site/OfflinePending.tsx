"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteIntent, listIntents, OFFLINE_QUEUE_CHANGED_EVENT } from "@/lib/offline-queue";
import { pendingIntentViews, type PendingIntentView } from "@/lib/offline-pending";

/** Lista os pedidos guardados sem internet, com opção de enviar agora ou descartar (além do prazo automático). */
export default function OfflinePending({ onSend }: { onSend: () => Promise<void> }) {
  const [items, setItems] = useState<PendingIntentView[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItems(pendingIntentViews(await listIntents()));
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, onChange);
    window.addEventListener("online", onChange);
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, onChange);
      window.removeEventListener("online", onChange);
    };
  }, [refresh]);

  if (hidden || items.length === 0) return null;
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <section
      aria-label="Pedidos guardados neste aparelho"
      className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-white/20 bg-asphalt p-3 text-cream shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:w-[22rem]"
    >
      <p className="font-display text-sm font-semibold">
        {items.length === 1 ? "1 pedido guardado" : `${items.length} pedidos guardados`}
      </p>
      <p className="mt-0.5 text-xs text-cream/75">
        {offline
          ? "Sem internet. Eles serão enviados quando a conexão voltar."
          : "Ainda não foram enviados. Você pode tentar agora ou descartar."}
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl bg-white/[0.06] p-2.5">
            <p className="text-sm">{item.title}</p>
            <p className="text-xs text-cream/70">Guardado por mais {item.timeLeft}</p>
            <div className="mt-1 flex flex-wrap gap-x-4">
              {confirmId === item.id ? (
                <>
                  <button
                    type="button"
                    className="min-h-11 text-sm font-semibold text-brand-light underline underline-offset-4"
                    onClick={async () => {
                      setConfirmId(null);
                      try {
                        await deleteIntent(item.id);
                      } catch {
                        // Ignora erro de armazenamento local.
                      }
                      await refresh();
                    }}
                  >
                    Confirmar descarte
                  </button>
                  <button type="button" className="min-h-11 text-sm underline underline-offset-4" onClick={() => setConfirmId(null)}>
                    Manter
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy || offline}
                    className="min-h-11 text-sm font-semibold underline underline-offset-4 disabled:opacity-50"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await onSend();
                      } finally {
                        setBusy(false);
                        await refresh();
                      }
                    }}
                  >
                    Enviar agora
                  </button>
                  <button type="button" className="min-h-11 text-sm underline underline-offset-4" onClick={() => setConfirmId(item.id)}>
                    Descartar
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className="mt-1 min-h-11 text-xs text-cream/75 underline underline-offset-4" onClick={() => setHidden(true)}>
        Dispensar por agora
      </button>
    </section>
  );
}
