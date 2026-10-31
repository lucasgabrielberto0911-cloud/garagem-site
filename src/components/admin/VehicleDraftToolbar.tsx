"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirmDialog } from "@/components/admin/useConfirmDialog";
import { useVehicleDraftAutosave } from "@/components/admin/useVehicleDraftAutosave";
import { btn } from "@/components/admin/ui";
import { draftBannerLabel, draftStatusText } from "@/lib/vehicle-draft-status";
export type VehicleDraftPayload = Record<string, unknown> & { step?: number };

/**
 * Status do rascunho: uma linha de texto pequeno e cinza (vermelho só quando
 * falha). Tocar nela mostra "Guardar agora" e "Guardar e sair". O aviso de
 * retomada só existe quando há rascunho guardado.
 */
export function VehicleDraftToolbar({
  draftKey,
  storageKey,
  enabled,
  published,
  snapshot,
  restore,
  disabled,
  onSavingChange,
  autoRestore,
}: {
  draftKey: string;
  storageKey: string;
  enabled: boolean;
  published: boolean;
  snapshot: () => VehicleDraftPayload;
  restore: (value: VehicleDraftPayload) => void;
  disabled: boolean;
  onSavingChange: (saving: boolean) => void;
  autoRestore?: boolean;
}) {
  const {
    draft,
    status,
    note,
    save,
    discard,
    savedAt,
    resumed,
    canResume,
    confirmDialog: saveConfirmDialog,
  } = useVehicleDraftAutosave({
    draftKey,
    storageKey,
    snapshot,
    restore,
    autoRestore,
    enabled,
    disabled,
    published,
    onSavingChange,
  });
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmAction, confirmDialog] = useConfirmDialog();
  const pending = status === "pending";
  const failed = status === "error" || status === "conflict";
  const text = draftStatusText({ status, savedAt });
  return (
    <div className="space-y-1.5">
      {confirmDialog}
      {saveConfirmDialog}
      {canResume && draft ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-white/10 bg-ink/50 px-3 py-2 text-sm text-cream"
        >
          <span className="min-w-0 flex-1 basis-48">
            {draftBannerLabel(draft, savedAt)}
          </span>
          <span className="flex gap-1">
            <button
              type="button"
              disabled={disabled || pending}
              className={btn.ghost}
              onClick={async () => {
                const ok = await confirmAction({
                  title: "Continuar o rascunho guardado?",
                  description: "Isso substitui os campos desta tela.",
                  confirmLabel: "Retomar",
                  danger: false,
                });
                if (ok) {
                  restore(draft);
                  resumed();
                }
              }}
            >
              Continuar
            </button>
            <button
              type="button"
              disabled={disabled || pending}
              className={btn.ghost}
              onClick={async () => {
                const ok = await confirmAction({
                  title: "Descartar o rascunho guardado?",
                  description: "Ele será apagado. Os campos desta tela ficam.",
                  confirmLabel: "Descartar",
                  danger: true,
                });
                if (ok) await discard();
              }}
            >
              Descartar
            </button>
          </span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={`min-h-6 touch-manipulation underline-offset-2 hover:underline ${
            failed ? "text-red-400" : "text-muted"
          }`}
        >
          {text}
        </button>
        {open ? (
          <>
            <button
              type="button"
              disabled={disabled || pending}
              onClick={() => void save()}
              className="min-h-6 text-cream underline underline-offset-2 disabled:opacity-50"
            >
              Guardar agora
            </button>
            <button
              type="button"
              disabled={disabled || pending}
              onClick={async () => {
                if (await save()) router.push("/admin/veiculos");
              }}
              className="min-h-6 text-cream underline underline-offset-2 disabled:opacity-50"
            >
              Guardar e sair
            </button>
          </>
        ) : null}
      </div>
      {failed && note ? (
        <p role="status" className="text-xs text-red-400">
          {note}
        </p>
      ) : null}
    </div>
  );
}
