"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { btn } from "@/components/admin/ui";
export type VehicleDraftPayload = Record<string, unknown>;
export function VehicleDraftToolbar({
  draftKey,
  snapshot,
  restore,
  disabled,
  onSavingChange,
}: {
  draftKey: string;
  snapshot: () => VehicleDraftPayload;
  restore: (value: VehicleDraftPayload) => void;
  disabled: boolean;
  onSavingChange: (saving: boolean) => void;
}) {
  const [draft, setDraft] = useState<VehicleDraftPayload | null>(null);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/admin/drafts?key=${encodeURIComponent(draftKey)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("read");
        const data = await response.json();
        if (active)
          setDraft(data.draft?.payload?.fields ? data.draft.payload : null);
      })
      .catch(() => {
        if (active)
          setNote(
            "Não foi possível consultar rascunhos. Seus campos continuam nesta tela.",
          );
      });
    return () => {
      active = false;
    };
  }, [draftKey]);
  async function save() {
    if (pending || disabled) return;
    setPending(true);
    onSavingChange(true);
    try {
      const payload = snapshot();
      const photos = Array.isArray(payload.photos)
        ? (payload.photos as Array<{ url: string; thumbnailUrl?: string }>)
        : [];
      const response = await fetch("/api/admin/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: draftKey,
          payload,
          photoUrls: photos.flatMap((photo) =>
            [photo.url, photo.thumbnailUrl].filter(Boolean),
          ),
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Não foi possível guardar o rascunho.");
      }
      setDraft(payload);
      setNote(
        "Rascunho privado guardado por 30 dias. Ainda não foi publicado.",
      );
      toast.success("Rascunho guardado. Ele não aparece no site.");
    } catch (error) {
      setNote(
        error instanceof Error
          ? error.message
          : "Falha ao guardar. Tente novamente.",
      );
    } finally {
      setPending(false);
      onSavingChange(false);
    }
  }
  return (
    <div className="space-y-2 border border-white/10 bg-ink/50 p-3 sm:space-y-3 sm:p-4">
      <p className="hidden text-sm leading-relaxed text-muted sm:block">
        Você pode guardar o trabalho incompleto e retomá-lo depois. O rascunho
        fica privado; só salvar o anúncio atualiza a vitrine.
      </p>
      <p className="text-xs text-muted sm:hidden">Rascunho privado · não publica o anúncio</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || pending}
          onClick={save}
          className={`${btn.outline} flex-1 sm:flex-none`}
        >
          {pending ? "Guardando…" : "Guardar rascunho"}
        </button>
        {draft ? (
          <button
            type="button"
            disabled={disabled || pending}
            className={`${btn.ghost} flex-1 sm:flex-none`}
            onClick={() => {
              if (
                window.confirm(
                  "Retomar o rascunho guardado? Isso substitui os campos desta tela.",
                )
              ) {
                restore(draft);
                setNote(
                  "Rascunho retomado. Confira os dados antes de publicar.",
                );
              }
            }}
          >
            Retomar rascunho
          </button>
        ) : null}
      </div>
      {note ? (
        <p role="status" className="text-sm text-cream">
          {note}
        </p>
      ) : null}
    </div>
  );
}
