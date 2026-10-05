"use client";
import { useEffect, useRef, useState } from "react";
import { OrderedSave } from "@/lib/ordered-save";
import type { VehicleDraftPayload } from "@/components/admin/VehicleDraftToolbar";

type Backup = { payload: VehicleDraftPayload; expiresAt: number; editor: string; syncedVersion: string | null };
type Status = "loading" | "idle" | "pending" | "saved" | "error" | "conflict";
export function useVehicleDraftAutosave({ draftKey, storageKey, snapshot, enabled, disabled, published, onSavingChange }: {
  draftKey: string; storageKey: string; snapshot: () => VehicleDraftPayload;
  enabled: boolean; disabled: boolean; published: boolean; onSavingChange: (saving: boolean) => void;
}) {
  const [draft, setDraft] = useState<VehicleDraftPayload | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [note, setNote] = useState("");
  const latest = useRef({ snapshot, enabled, disabled, published, onSavingChange });
  latest.current = { snapshot, enabled, disabled, published, onSavingChange };
  const version = useRef<string | null>(null);
  const recovery = useRef(false);
  const conflict = useRef(false);
  const ready = useRef(false);
  const fingerprint = useRef("");
  const editor = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const queue = useRef<OrderedSave<VehicleDraftPayload> | null>(null);
  const capture = useRef(() => {});
  const reload = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let active = true;
    const loading = new AbortController();
    editor.current = crypto.randomUUID();
    ready.current = false;
    fingerprint.current = "";
    function store(payload: VehicleDraftPayload, syncedVersion: string | null) {
      try {
        const value = JSON.stringify({ payload, syncedVersion, editor: editor.current, expiresAt: Date.now() + 30 * 86400000 } satisfies Backup);
        sessionStorage.setItem(storageKey, value);
        if (!recovery.current) localStorage.setItem(storageKey, value);
      }
      catch { if (active) setNote("Não foi possível manter uma cópia neste aparelho. Mantenha a tela aberta até salvar."); }
    }
    const writes = new OrderedSave<VehicleDraftPayload>(async (payload) => {
      if (!active || latest.current.disabled || latest.current.published || conflict.current) throw new Error("paused");
      controller.current = new AbortController();
      const photos = Array.isArray(payload.photos) ? payload.photos as Array<{ url: string; thumbnailUrl?: string }> : [];
      const response = await fetch("/api/admin/drafts", { method: "POST", signal: controller.current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: draftKey, payload, expectedUpdatedAt: version.current, photoUrls: photos.flatMap(p => [p.url, p.thumbnailUrl].filter(Boolean)) }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) conflict.current = true;
        if (active) setNote(data.error || "Não foi possível salvar o rascunho. Tente novamente.");
        throw new Error("save");
      }
      if (!active || latest.current.published) return;
      version.current = data.updatedAt;
      setDraft(payload);
      if (fingerprint.current === JSON.stringify(payload)) store(payload, data.updatedAt);
    }, state => {
      if (!active || latest.current.published) return;
      setStatus(conflict.current ? "conflict" : state);
      latest.current.onSavingChange(state === "pending");
      if (state === "saved") setNote("Rascunho privado salvo. O anúncio ainda não foi publicado.");
      if (state === "error" && !conflict.current) setNote("Rascunho não salvo no servidor. Seus campos continuam aqui; tente novamente.");
    });
    queue.current = writes;
    capture.current = () => {
      if (!active || !latest.current.enabled || latest.current.published) return;
      const payload = latest.current.snapshot();
      const key = JSON.stringify(payload);
      if (key === fingerprint.current) return;
      fingerprint.current = key;
      // A cópia local é imediata; o servidor recebe após uma pausa na digitação.
      store(payload, null);
      if (timer.current) clearTimeout(timer.current);
      if (!ready.current || recovery.current || conflict.current || latest.current.disabled) return;
      setStatus("pending");
      timer.current = setTimeout(() => {
        if (active && latest.current.enabled && !latest.current.disabled && !latest.current.published && !recovery.current && !conflict.current) writes.enqueue(payload);
      }, 1000);
    };
    const read = async () => {
      try {
        const response = await fetch(`/api/admin/drafts?key=${encodeURIComponent(draftKey)}`, { cache: "no-store", signal: loading.signal });
        if (!response.ok) throw new Error("read");
        const data = await response.json();
        if (!active) return;
        const remote = data.draft?.payload?.fields ? data.draft : null;
        version.current = remote?.updatedAt ?? null;
        let local: Backup | null = null;
        try { local = JSON.parse(sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey) || "null"); } catch {}
        if (local && (local.expiresAt <= Date.now() || !local.payload?.fields)) local = null;
        const saved = local?.syncedVersion === null ? local.payload : remote?.payload;
        if (saved) {
          setDraft(saved); recovery.current = !latest.current.enabled || JSON.stringify(saved) !== JSON.stringify(latest.current.snapshot());
          setNote("Há um rascunho privado para retomar. Ele não foi publicado.");
        }
        setStatus("idle"); ready.current = true;
        fingerprint.current = ""; capture.current();
      } catch {
        if (active) {
          try {
            const local = JSON.parse(sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey) || "null") as Backup | null;
            if (local?.payload?.fields && local.expiresAt > Date.now()) { setDraft(local.payload); recovery.current = true; }
          } catch {}
          setStatus("error"); setNote("Não foi possível consultar o servidor. Seus campos continuam neste aparelho. Tente novamente.");
        }
      }
    };
    reload.current = read; void read();
    const form = document.getElementById("vehicle-form");
    const change = () => { setTimeout(() => capture.current(), 0); };
    const online = () => { if (ready.current && !recovery.current && !conflict.current && !latest.current.disabled && !latest.current.published) writes.retry(); };
    const storage = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue || latest.current.published) return;
      try {
        const other = JSON.parse(event.newValue) as Backup;
        if (other.editor !== editor.current && JSON.stringify(other.payload) !== fingerprint.current) {
          recovery.current = true; conflict.current = true; controller.current?.abort();
          if (timer.current) clearTimeout(timer.current);
          setStatus("conflict"); setDraft(other.payload);
          setNote("Outra aba alterou o rascunho. Seus campos foram mantidos; escolha qual versão guardar ou retomar.");
        }
      } catch {}
    };
    form?.addEventListener("input", change); form?.addEventListener("change", change);
    window.addEventListener("online", online); window.addEventListener("storage", storage);
    return () => {
      active = false; loading.abort(); controller.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      form?.removeEventListener("input", change); form?.removeEventListener("change", change);
      window.removeEventListener("online", online); window.removeEventListener("storage", storage);
      latest.current.onSavingChange(false);
    };
  }, [draftKey, storageKey]);

  useEffect(() => { capture.current(); }, [snapshot, enabled, disabled]);
  useEffect(() => { if (!disabled) { fingerprint.current = ""; capture.current(); } }, [disabled]);
  useEffect(() => {
    if (disabled || published) { controller.current?.abort(); if (timer.current) clearTimeout(timer.current); }
    if (published) { try { localStorage.removeItem(storageKey); sessionStorage.removeItem(storageKey); } catch {} }
  }, [disabled, published, storageKey]);

  async function save() {
    if (disabled || published || status === "pending") return;
    if (!ready.current) { await reload.current(); if (!ready.current) return; }
    if ((recovery.current || conflict.current) && !window.confirm("Guardar os campos desta tela no lugar do rascunho anterior?")) return;
    // Releitura após decisão explícita; uma nova disputa continua protegida no servidor.
    if (recovery.current || conflict.current) {
      try {
        const response = await fetch(`/api/admin/drafts?key=${encodeURIComponent(draftKey)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("read");
        const data = await response.json();
        version.current = data.draft?.payload?.fields ? data.draft.updatedAt : null;
      } catch { setNote("Não foi possível consultar a versão salva. Tente novamente."); return; }
    }
    recovery.current = false; conflict.current = false;
    if (timer.current) clearTimeout(timer.current);
    fingerprint.current = "";
    const payload = latest.current.snapshot();
    try {
      const value = JSON.stringify({ payload, expiresAt: Date.now() + 30 * 86400000, editor: editor.current, syncedVersion: null } satisfies Backup);
      localStorage.setItem(storageKey, value); sessionStorage.setItem(storageKey, value);
    } catch {}
    fingerprint.current = JSON.stringify(payload);
    queue.current?.enqueue(payload);
  }
  async function resumed() {
    try {
      const response = await fetch(`/api/admin/drafts?key=${encodeURIComponent(draftKey)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("read");
      const data = await response.json();
      version.current = data.draft?.payload?.fields ? data.draft.updatedAt : null;
      ready.current = true;
    } catch { setNote("Rascunho retomado neste aparelho. Não foi possível salvar no servidor; tente novamente."); return; }
    recovery.current = false; conflict.current = false; fingerprint.current = "";
    setTimeout(() => capture.current(), 0);
  }
  return { draft, status, note, save, resumed };
}
