"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { createSellLead } from "@/app/(site)/vender/actions";
import { trackPwaEvent } from "@/lib/meta-pixel";
import {
  deleteIntent,
  listIntents,
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
  const items = await listIntents();
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
        toast.success("Enviamos o pedido de avaliação que ficou guardado.");
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
    toast.success(
      remaining > 0
        ? `Abrimos o WhatsApp. Ainda há ${remaining} recado(s) na fila.`
        : "Abrimos o WhatsApp com o recado que ficou guardado.",
    );
  } else {
    toast("Há um recado de interesse pronto. Toque para abrir o WhatsApp.", {
      action: {
        label: "Abrir",
        onClick: () => {
          window.location.href = first.url;
        },
      },
    });
  }
}

export function OfflineLeadFlush() {
  useEffect(() => {
    function onOnline() {
      void flushQueue();
    }
    window.addEventListener("online", onOnline);
    if (navigator.onLine) {
      void flushQueue();
    }
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}
