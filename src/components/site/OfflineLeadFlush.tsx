"use client";

import { useEffect } from "react";
import { notify, notifySuccess } from "@/lib/notify";
import { createSellLead } from "@/app/(site)/vender/actions";
import { trackPwaEvent } from "@/lib/meta-pixel";
import {
  claimIntent,
  deleteIntent,
  listIntents,
  releaseIntentClaim,
  type OfflineIntent,
  type SellIntent,
} from "@/lib/offline-queue";

let activeFlushPromise: Promise<void> | null = null;

function sellFormData(intent: SellIntent & { id?: string }) {
  const data = new FormData();
  for (const [key, value] of Object.entries(intent.fields)) {
    if (key === "photoUrls") continue;
    data.set(key, value);
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
    items = await listIntents();
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
    try {
      await releaseIntentClaim(first.id);
    } catch {
      // Mantém na fila para quando o usuário clicar em Abrir.
    }
    notify("Há um recado de interesse pronto. Toque para abrir o WhatsApp.", {
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

export function OfflineLeadFlush() {
  useEffect(() => {
    function onOnline() {
      void flushQueue();
    }
    window.addEventListener("online", onOnline);
    let cancelIdle: (() => void) | undefined;
    if (navigator.onLine) {
      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof win.requestIdleCallback === "function") {
        const id = win.requestIdleCallback(() => void flushQueue(), { timeout: 2500 });
        cancelIdle = () => win.cancelIdleCallback?.(id);
      } else {
        const timer = window.setTimeout(() => void flushQueue(), 600);
        cancelIdle = () => window.clearTimeout(timer);
      }
    }
    return () => {
      cancelIdle?.();
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
