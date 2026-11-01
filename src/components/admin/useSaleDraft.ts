"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saleDraftFields } from "@/lib/sale-draft";
import { useUnsavedChangesWarning } from "./useUnsavedChangesWarning";

/** Reaproveita rascunhos privados do admin: sessão autenticada, versão e retenção de 24h. */
export function useSaleDraft(key: string, value: ReturnType<typeof saleDraftFields>, restore: (value: ReturnType<typeof saleDraftFields>) => void) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Carregando rascunho…");
  const [pending, setPending] = useState(false);
  const version = useRef<string | null>(null);
  const saved = useRef("");
  const closed = useRef(false);
  const chain = useRef(Promise.resolve());
  const latest = useRef("");
  const json = JSON.stringify(saleDraftFields(value));

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/drafts?key=${encodeURIComponent(key)}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error();
      const { draft } = await response.json();
      if (!active) return;
      if (draft?.payload?.fields) {
        const fields = saleDraftFields(draft.payload.fields);
        restore(fields);
        version.current = draft.updatedAt;
        saved.current = JSON.stringify(fields);
        setStatus("Rascunho recuperado. Confira os dados antes de concluir.");
      } else setStatus("O preenchimento será guardado por 24 horas, somente para seu usuário.");
      setReady(true);
    }).catch(() => { if (active) setStatus("Rascunho indisponível. Recarregue para tentar novamente antes de preencher."); });
    return () => { active = false; };
  }, [key, restore]);

  const persist = useCallback((snapshot: string) => {
    if (closed.current || !snapshot || snapshot === saved.current) return;
    setPending(true);
    setStatus("Guardando rascunho…");
    chain.current = chain.current.catch(() => {}).then(async () => {
      if (closed.current || snapshot === saved.current) return;
      const response = await fetch("/api/admin/drafts", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, payload: { fields: JSON.parse(snapshot) }, photoUrls: [], expectedUpdatedAt: version.current }) });
      if (!response.ok) throw new Error(response.status === 409 ? "O rascunho mudou em outra aba. Seu preenchimento continua nesta tela; confira a outra aba antes de sair." : "Não foi possível guardar. Seus dados continuam nesta tela; tente novamente antes de sair.");
      version.current = (await response.json()).updatedAt;
      saved.current = snapshot;
      if (latest.current === snapshot) { setPending(false); setStatus("Rascunho guardado por 24 horas, somente para seu usuário."); }
    }).catch((error) => { setPending(true); setStatus(error.message); });
  }, [key]);

  useEffect(() => {
    if (!ready || closed.current) return;
    latest.current = json;
    if (!saved.current) { saved.current = json; return; }
    if (json === saved.current) return;
    setPending(true);
    const timer = setTimeout(() => persist(json), 350);
    return () => clearTimeout(timer);
  }, [json, ready, persist]);

  useEffect(() => {
    const flush = () => persist(latest.current);
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [persist]);
  useUnsavedChangesWarning(pending);

  async function clear() {
    closed.current = true;
    await chain.current;
    const response = await fetch(`/api/admin/drafts?key=${encodeURIComponent(key)}`, { method: "DELETE", keepalive: true });
    if (!response.ok) { closed.current = false; throw new Error("Não foi possível descartar o rascunho. Tente novamente."); }
    setPending(false);
  }
  return { ready, status, clear, retry: () => persist(latest.current) };
}
