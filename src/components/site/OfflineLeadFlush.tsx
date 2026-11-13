"use client";

import { useCallback, useEffect, useState } from "react";
import { notify, notifySuccess } from "@/lib/notify";
import { createSellLead } from "@/app/(site)/vender/actions";
import { trackPwaEvent } from "@/lib/meta-pixel";
import {
  claimIntent,
  deleteIntent,
  listIntents,
  OFFLINE_QUEUE_CHANGED_EVENT,
  partitionIntents,
  pendingIntentViews,
  releaseIntentClaim,
  runSingleFlush,
  type OfflineIntent,
  type PendingIntentView,
  type SellIntent,
} from "@/lib/offline-queue";

let activeFlushPromise: Promise<void> | null = null;

function sellFormData(intent: SellIntent & { id?: string }) {
  const data = new FormData();
  for (const [key, value] of Object.entries(intent.fields)) {
    if (key === "photoUrls") continue;
    data.set(key, value);
  }
  if (!data.get("requestKey") && intent.id) {
    data.set("requestKey", intent.id);
  }
  if (!data.get("requestId") && intent.id) {
    data.set("requestId", intent.id);
  }
  for (const url of intent.photoUrls ?? []) {
    data.append("photoUrls", url);
  }
  return data;
}

async function flushQueueInner() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  let items: OfflineIntent[];
  try {
    const stored = await listIntents();
    // Pedido velho demais pode já ter sido resolvido por outro meio: sai sem enviar.
    const { fresh, expired } = partitionIntents(stored);
    for (const item of expired) {
      try {
        await deleteIntent(item.id);
      } catch {
        // Ignora erro de armazenamento local.
      }
    }
    items = fresh;
  } catch {
    return;
  }
  if (items.length === 0) return;

  const whatsapp = items.filter((item) => item.type === "whatsapp");
  const sells = items.filter((item) => item.type === "sell");
  const favorites = items.filter((item) => item.type === "favorite");

  for (const item of favorites) {
    try {
      await deleteIntent(item.id);
    } catch {
      // Ignora erro de armazenamento local.
    }
  }

  for (const item of sells) {
    let claimed = false;
    try {
      claimed = await claimIntent(item.id);
      if (!claimed) continue;
      const result = await createSellLead(sellFormData(item));
      if (result.ok) {
        await deleteIntent(item.id);
        trackPwaEvent("PwaOfflineFlushed", { kind: "sell" });
        notifySuccess("Enviamos o pedido de avaliação que ficou guardado.");
      } else {
        await releaseIntentClaim(item.id);
      }
    } catch {
      if (claimed) {
        try {
          await releaseIntentClaim(item.id);
        } catch {
          // Ignora falha ao liberar claim.
        }
      }
      break;
    }
  }

  if (whatsapp.length === 0) return;
  const first = whatsapp[0] as OfflineIntent & { type: "whatsapp" };
  let claimedFirst = false;
  try {
    claimedFirst = await claimIntent(first.id);
  } catch {
    return;
  }
  if (!claimedFirst) return;

  const opened = window.open(first.url, "_blank", "noopener,noreferrer");
  if (opened) {
    try {
      await deleteIntent(first.id);
    } catch {
      // Ignora erro de exclusão no IndexedDB.
    }
    trackPwaEvent("PwaOfflineFlushed", { kind: "whatsapp" });
    const remaining = whatsapp.length - 1;
    notifySuccess(
      remaining > 0
        ? `Abrimos o WhatsApp. Ainda há ${remaining} recado(s) na fila.`
        : "Abrimos o WhatsApp com o recado que ficou guardado.",
    );
  } else {
    // Pop-up bloqueado: o recado só sai da fila quando a pessoa abre ou descarta.
    // Se o aviso sumir sozinho, ele volta na próxima visita.
    try {
      await releaseIntentClaim(first.id);
    } catch {
      // Mantém na fila para quando o usuário clicar em Abrir.
    }
    notify("Há um recado de interesse pronto. Toque para abrir o WhatsApp.", {
      duration: Infinity,
      action: {
        label: "Abrir",
        onClick: () => {
          void deleteIntent(first.id)
            .catch(() => {})
            .finally(() => {
              window.location.href = first.url;
            });
        },
      },
      cancel: {
        label: "Descartar",
        onClick: () => {
          void deleteIntent(first.id).catch(() => {});
        },
      },
    });
  }
}

export async function flushQueue() {
  if (activeFlushPromise) return activeFlushPromise;
  const run = async () => {
    try {
      const locks =
        typeof navigator !== "undefined"
          ? (navigator as Navigator & {
              locks?: {
                request: (
                  name: string,
                  options: { ifAvailable: boolean },
                  callback: (lock: unknown) => Promise<void>,
                ) => Promise<void>;
              };
            }).locks
          : undefined;
      if (locks?.request) {
        await locks.request("garagem-offline-flush", { ifAvailable: true }, async (lock) => {
          if (!lock) return;
          await flushQueueInner();
        });
      } else {
        await flushQueueInner();
      }
    } catch {
      // Nunca propaga rejeição não tratada quando IndexedDB falha.
    }
  };
  activeFlushPromise = run().finally(() => {
    activeFlushPromise = null;
  });
  return activeFlushPromise;
}

/** Falha ao abrir o IndexedDB (modo privado, cota) não pode virar promessa rejeitada: a fila fica como está. */
function safeFlush() {
  return runSingleFlush(flushQueue).catch(() => {});
}

/** Lista os pedidos guardados sem internet, com opção de enviar agora ou descartar (além do prazo automático). */
function OfflinePending() {
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
                        await flushQueue();
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

export function OfflineLeadFlush() {
  useEffect(() => {
    function onOnline() {
      void safeFlush();
    }
    window.addEventListener("online", onOnline);
    let cancelIdle: (() => void) | undefined;
    if (navigator.onLine) {
      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof win.requestIdleCallback === "function") {
        const id = win.requestIdleCallback(() => void safeFlush(), { timeout: 2500 });
        cancelIdle = () => win.cancelIdleCallback?.(id);
      } else {
        const timer = window.setTimeout(() => void safeFlush(), 600);
        cancelIdle = () => window.clearTimeout(timer);
      }
    }
    return () => {
      cancelIdle?.();
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return <OfflinePending />;
}
