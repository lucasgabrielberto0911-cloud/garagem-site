"use client";

import { useCallback, useEffect, useState } from "react";
import { createSellLead } from "@/app/(site)/vender/actions";
import { trackPwaEvent } from "@/lib/meta-pixel";
import { notifySuccess } from "@/lib/notify";
import { claimIntent, deleteIntent, listIntents, offlineIntentState, releaseIntent, type OfflineIntent, type SellIntent } from "@/lib/offline-queue";

function sellFormData(intent: SellIntent & { id: string }) {
  const data = new FormData();
  for (const [key, value] of Object.entries(intent.fields)) {
    if (key !== "photoUrls") data.set(key, value);
  }
  data.set("requestId", intent.fields.requestId || intent.id);
  for (const url of intent.photoUrls ?? []) data.append("photoUrls", url);
  return data;
}

let flushing: Promise<void> | null = null;
async function sendQueue(confirmedId?: string) {
  if (!navigator.onLine) return;
  const items = await listIntents();
  for (const item of items) {
    if (offlineIntentState(item) === "expired" || item.type === "favorite") {
      await deleteIntent(item.id);
      continue;
    }
    if (item.type !== "sell" || (item.id !== confirmedId && offlineIntentState(item) !== "fresh")) continue;
    const owner = crypto.randomUUID();
    if (!(await claimIntent(item.id, owner))) continue;
    try {
      const result = await createSellLead(sellFormData(item));
      if (!result.ok) break;
      await deleteIntent(item.id);
      trackPwaEvent("PwaOfflineFlushed", { kind: "sell" });
      notifySuccess("Enviamos a avaliação que ficou guardada.");
    } finally { await releaseIntent(item.id, owner); }
  }
}

export function OfflineLeadFlush() {
  const [items, setItems] = useState<OfflineIntent[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (confirmedId?: string) => {
    setBusy(true);
    try {
      if (!flushing) flushing = sendQueue(confirmedId).finally(() => { flushing = null; });
      await flushing;
      setItems(await listIntents());
      setError("");
    } catch { setError("Pendências indisponíveis neste aparelho. Tente novamente; não confirmamos nenhum envio."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    const online = () => { void refresh(); };
    window.addEventListener("online", online);
    window.addEventListener("focus", online);
    void refresh();
    return () => { window.removeEventListener("online", online); window.removeEventListener("focus", online); };
  }, [refresh]);

  if (!items.length && !error) return null;
  return <aside aria-label="Pedidos pendentes" className="border-t border-white/10 bg-asphalt p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] text-sm text-cream lg:pb-4">
    <p role="status">{error || "Pedidos guardados neste aparelho por até 7 dias. Para enviar, reabra o site conectado. Avaliações com mais de 15 minutos precisam da sua confirmação."}</p>
    {error && <button type="button" disabled={busy} className="min-h-11 underline" onClick={() => void refresh()}>Tentar novamente</button>}
    <ul>{items.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-3 py-2">
      <span>{item.type === "whatsapp" ? item.label || "Recado de WhatsApp" : "Avaliação pendente"}</span>
      {item.type === "whatsapp" ? <a className="inline-flex min-h-11 items-center underline" href={item.url} onClick={(event) => {
        event.preventDefault();
        // A ação do usuário abre o link; expiração de aviso nunca apaga o recado.
        window.location.href = item.url;
        void deleteIntent(item.id).catch(() => {});
      }}>Abrir WhatsApp</a> : <button type="button" disabled={busy} className="min-h-11 underline" onClick={() => void refresh(item.id)}>Enviar avaliação</button>}
      <button type="button" disabled={busy} className="min-h-11 underline" onClick={async () => {
        try { await deleteIntent(item.id); setItems(await listIntents()); }
        catch { setError("Não foi possível descartar. Tente novamente."); }
      }}>Descartar pedido</button>
    </li>)}</ul>
  </aside>;
}
