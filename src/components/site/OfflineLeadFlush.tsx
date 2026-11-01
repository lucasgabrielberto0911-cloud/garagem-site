"use client";

import { useEffect } from "react";
import { notify, notifySuccess } from "@/lib/notify";
import { createSellLead } from "@/app/(site)/vender/actions";
import { trackPwaEvent } from "@/lib/meta-pixel";
import {
  deleteIntent,
  listIntents,
  partitionIntents,
  runSingleFlush,
  type OfflineIntent,
  type SellIntent,
} from "@/lib/offline-queue";

function sellFormData(intent: SellIntent) {
  const data = new FormData();
  for (const [key, value] of Object.entries(intent.fields)) {
    if (key === "photoUrls") continue;
    data.set(key, value);
  }
  for (const url of intent.photoUrls ?? []) {
    data.append("photoUrls", url);
  }
  return data;
}

async function flushQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const stored = await listIntents();
  // Pedido velho demais pode já ter sido resolvido por outro meio: sai sem enviar.
  const { fresh: items, expired } = partitionIntents(stored);
  for (const item of expired) await deleteIntent(item.id);
  if (items.length === 0) return;

  const whatsapp = items.filter((item) => item.type === "whatsapp");
  const sells = items.filter((item) => item.type === "sell");
  const favorites = items.filter((item) => item.type === "favorite");

  for (const item of favorites) {
    await deleteIntent(item.id);
  }

  for (const item of sells) {
    try {
      const result = await createSellLead(sellFormData(item));
      if (result.ok) {
        await deleteIntent(item.id);
        trackPwaEvent("PwaOfflineFlushed", { kind: "sell" });
        notifySuccess("Enviamos o pedido de avaliação que ficou guardado.");
      }
    } catch {
      break;
    }
  }

  if (whatsapp.length === 0) return;
  const first = whatsapp[0] as OfflineIntent & { type: "whatsapp" };
  const opened = window.open(first.url, "_blank", "noopener,noreferrer");
  if (opened) {
    await deleteIntent(first.id);
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
    notify("Há um recado de interesse pronto. Toque para abrir o WhatsApp.", {
      duration: Infinity,
      action: {
        label: "Abrir",
        onClick: () => {
          void deleteIntent(first.id).catch(() => {});
          window.location.href = first.url;
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

/** Falha ao abrir o IndexedDB (modo privado, cota) não pode virar promessa rejeitada: a fila fica como está. */
function safeFlush() {
  return runSingleFlush(flushQueue).catch(() => {});
}

export function OfflineLeadFlush() {
  useEffect(() => {
    function onOnline() {
      void safeFlush();
    }
    window.addEventListener("online", onOnline);
    if (navigator.onLine) {
      void safeFlush();
    }
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}
