"use client";
import { useEffect, useRef, useState } from "react";
import { useConfirmDialog } from "@/components/admin/useConfirmDialog";
import { OrderedSave } from "@/lib/ordered-save";
import type { VehicleDraftPayload } from "@/components/admin/VehicleDraftToolbar";

type Backup = {
  payload: VehicleDraftPayload;
  expiresAt: number;
  editor: string;
  syncedVersion: string | null;
};
type Status = "loading" | "idle" | "pending" | "saved" | "error" | "conflict";

function readBackup(storageKey: string): Backup | null {
  try {
    const backup = JSON.parse(
      sessionStorage.getItem(storageKey) ||
        localStorage.getItem(storageKey) ||
        "null",
    ) as Backup | null;
    return backup?.payload?.fields && backup.expiresAt > Date.now()
      ? backup
      : null;
  } catch {
    return null;
  }
}

async function loadDraft(key: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/admin/drafts?key=${encodeURIComponent(key)}`,
    {
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok) throw new Error("read");
  const data = (await response.json()) as {
    draft: { payload: VehicleDraftPayload; updatedAt: string } | null;
  };
  return data.draft?.payload?.fields ? data.draft : null;
}

export function useVehicleDraftAutosave({
  draftKey,
  storageKey,
  snapshot,
  restore,
  autoRestore,
  enabled,
  disabled,
  published,
  onSavingChange,
}: {
  draftKey: string;
  storageKey: string;
  snapshot: () => VehicleDraftPayload;
  restore?: (value: VehicleDraftPayload) => void;
  autoRestore?: boolean;
  enabled: boolean;
  disabled: boolean;
  published: boolean;
  onSavingChange: (saving: boolean) => void;
}) {
  const [confirmAction, confirmDialog] = useConfirmDialog();
  const [draft, setDraft] = useState<VehicleDraftPayload | null>(null);
  const [canResume, setCanResume] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [note, setNote] = useState("");
  const latest = useRef({
    snapshot,
    restore,
    autoRestore,
    enabled,
    disabled,
    published,
    onSavingChange,
  });
  latest.current = {
    snapshot,
    restore,
    autoRestore,
    enabled,
    disabled,
    published,
    onSavingChange,
  };
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
    recovery.current = false;
    conflict.current = false;
    version.current = null;
    setDraft(null);
    fingerprint.current = "";
    function store(payload: VehicleDraftPayload, syncedVersion: string | null) {
      try {
        const value = JSON.stringify({
          payload,
          syncedVersion,
          editor: editor.current,
          expiresAt: Date.now() + 30 * 86400000,
        } satisfies Backup);
        sessionStorage.setItem(storageKey, value);
        if (!recovery.current) localStorage.setItem(storageKey, value);
      } catch {
        if (active)
          setNote(
            "Não foi possível manter uma cópia neste aparelho. Mantenha a tela aberta até salvar.",
          );
      }
    }
    const writes = new OrderedSave<VehicleDraftPayload>(
      async (payload) => {
        if (
          !active ||
          latest.current.disabled ||
          latest.current.published ||
          conflict.current
        )
          throw new Error("paused");
        controller.current = new AbortController();
        const photos = Array.isArray(payload.photos)
          ? (payload.photos as Array<{ url: string; thumbnailUrl?: string }>)
          : [];
        const response = await fetch("/api/admin/drafts", {
          method: "POST",
          signal: controller.current.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: draftKey,
            payload,
            expectedUpdatedAt: version.current,
            photoUrls: photos.flatMap((p) =>
              [p.url, p.thumbnailUrl].filter(Boolean),
            ),
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 409) conflict.current = true;
          if (active)
            setNote(
              data.error ||
                "Não foi possível salvar o rascunho. Tente novamente.",
            );
          throw new Error("save");
        }
        if (!active || latest.current.published) return;
        version.current = data.draft.updatedAt;
        store(payload, data.draft.updatedAt);
        setStatus("saved");
        setNote("Rascunho privado guardado.");
      },
      {
        onBusyChange: (busy) => {
          if (!active) return;
          latest.current.onSavingChange(busy);
          if (busy) {
            setStatus("pending");
            setNote("Salvando rascunho…");
          }
        },
      },
    );
    queue.current = writes;

    capture.current = () => {
      if (
        !ready.current ||
        recovery.current ||
        conflict.current ||
        latest.current.disabled ||
        latest.current.published
      )
        return;
      const next = latest.current.snapshot();
      const stringified = JSON.stringify(next);
      if (stringified === fingerprint.current) return;
      fingerprint.current = stringified;
      store(next, null);
      if (timer.current) clearTimeout(timer.current);
      if (!latest.current.enabled) {
        setStatus("idle");
        setNote("");
        return;
      }
      setStatus("pending");
      setNote("Salvando rascunho…");
      timer.current = setTimeout(() => {
        writes.enqueue(next);
      }, 1000);
    };
    const read = async () => {
      try {
        const remote = await loadDraft(draftKey, loading.signal);
        if (!active) return;
        version.current = remote?.updatedAt ?? null;
        const local = readBackup(storageKey);
        const saved =
          local?.syncedVersion === null ? local.payload : remote?.payload;
        if (saved) {
          setDraft(saved);
          let shouldAuto = Boolean(latest.current.autoRestore);
          if (!shouldAuto) {
            try {
              const autoKey = `${storageKey}:auto-restore`;
              if (sessionStorage.getItem(autoKey) === "1") {
                sessionStorage.removeItem(autoKey);
                shouldAuto = true;
              }
            } catch {}
          }
          if (shouldAuto && latest.current.restore) {
            latest.current.restore(saved);
            recovery.current = false;
            conflict.current = false;
            setCanResume(false);
            fingerprint.current = JSON.stringify(saved);
            store(saved, version.current);
          } else {
            const needsRecovery =
              !latest.current.enabled ||
              JSON.stringify(saved) !==
                JSON.stringify(latest.current.snapshot());
            recovery.current = needsRecovery;
            setCanResume(needsRecovery);
            if (needsRecovery) {
              setNote(
                "Há um rascunho privado para retomar. Ele não foi publicado.",
              );
            }
          }
        } else {
          setCanResume(false);
        }
        setStatus("idle");
        ready.current = true;
        fingerprint.current = "";
        capture.current();
      } catch {
        if (active) {
          const local = readBackup(storageKey);
          if (local) {
            setDraft(local.payload);
            let shouldAuto = Boolean(latest.current.autoRestore);
            if (!shouldAuto) {
              try {
                const autoKey = `${storageKey}:auto-restore`;
                if (sessionStorage.getItem(autoKey) === "1") {
                  sessionStorage.removeItem(autoKey);
                  shouldAuto = true;
                }
              } catch {}
            }
            if (shouldAuto && latest.current.restore) {
              latest.current.restore(local.payload);
              recovery.current = false;
              setCanResume(false);
            } else {
              recovery.current = true;
              setCanResume(true);
            }
          }
          setStatus("error");
          setNote(
            "Não foi possível consultar o servidor. Seus campos continuam neste aparelho. Tente novamente.",
          );
        }
      }
    };
    reload.current = read;
    void read();
    const form = document.getElementById("vehicle-form");
    const change = () => {
      setTimeout(() => capture.current(), 0);
    };
    const online = () => {
      if (
        ready.current &&
        !recovery.current &&
        !conflict.current &&
        !latest.current.disabled &&
        !latest.current.published
      )
        writes.retry();
    };
    const storage = (event: StorageEvent) => {
      if (
        event.key !== storageKey ||
        !event.newValue ||
        latest.current.published
      )
        return;
      try {
        const other = JSON.parse(event.newValue) as Backup;
        if (
          other.editor !== editor.current &&
          JSON.stringify(other.payload) !== fingerprint.current
        ) {
          recovery.current = true;
          conflict.current = true;
          controller.current?.abort();
          if (timer.current) clearTimeout(timer.current);
          setStatus("conflict");
          setDraft(other.payload);
          setCanResume(true);
          setNote(
            "Outra aba alterou o rascunho. Seus campos foram mantidos; escolha qual versão guardar ou retomar.",
          );
        }
      } catch {}
    };
    form?.addEventListener("input", change);
    form?.addEventListener("change", change);
    window.addEventListener("online", online);
    window.addEventListener("storage", storage);
    return () => {
      active = false;
      loading.abort();
      controller.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      form?.removeEventListener("input", change);
      form?.removeEventListener("change", change);
      window.removeEventListener("online", online);
      window.removeEventListener("storage", storage);
      latest.current.onSavingChange(false);
    };
  }, [draftKey, storageKey]);

  useEffect(() => {
    capture.current();
  }, [snapshot, enabled, disabled]);
  useEffect(() => {
    if (!disabled) {
      fingerprint.current = "";
      capture.current();
    }
  }, [disabled]);
  useEffect(() => {
    if (disabled || published) {
      controller.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    }
    if (published) {
      try {
        localStorage.removeItem(storageKey);
        sessionStorage.removeItem(storageKey);
      } catch {}
    }
  }, [disabled, published, storageKey]);

  async function save() {
    if (disabled || published || status === "pending") return;
    if (!ready.current) {
      await reload.current();
      if (!ready.current) return;
    }
    if (recovery.current || conflict.current) {
      const confirmed = await confirmAction({
        title: "Substituir o rascunho anterior?",
        description:
          "Os campos desta tela serão guardados no lugar da versão anterior.",
        confirmLabel: "Guardar",
      });
      if (!confirmed || latest.current.disabled || latest.current.published)
        return;
    }
    // Releitura após decisão explícita; uma nova disputa continua protegida no servidor.
    if (recovery.current || conflict.current) {
      try {
        version.current = (await loadDraft(draftKey))?.updatedAt ?? null;
      } catch {
        setNote("Não foi possível consultar a versão salva. Tente novamente.");
        return;
      }
    }
    recovery.current = false;
    conflict.current = false;
    setCanResume(false);
    if (timer.current) clearTimeout(timer.current);
    fingerprint.current = "";
    const payload = latest.current.snapshot();
    try {
      const value = JSON.stringify({
        payload,
        expiresAt: Date.now() + 30 * 86400000,
        editor: editor.current,
        syncedVersion: null,
      } satisfies Backup);
      localStorage.setItem(storageKey, value);
      sessionStorage.setItem(storageKey, value);
    } catch {}
    fingerprint.current = JSON.stringify(payload);
    queue.current?.enqueue(payload);
  }
  async function resumed() {
    try {
      version.current = (await loadDraft(draftKey))?.updatedAt ?? null;
      ready.current = true;
    } catch {
      setNote(
        "Rascunho retomado neste aparelho. Não foi possível salvar no servidor; tente novamente.",
      );
      return;
    }
    recovery.current = false;
    conflict.current = false;
    fingerprint.current = "";
    setCanResume(false);
    setTimeout(() => capture.current(), 0);
  }
  return { draft, status, note, save, resumed, canResume, confirmDialog };
}
