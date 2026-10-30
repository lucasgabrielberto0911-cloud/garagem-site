"use client";
import { useConfirmDialog } from "@/components/admin/useConfirmDialog";
import { useVehicleDraftAutosave } from "@/components/admin/useVehicleDraftAutosave";
import { btn } from "@/components/admin/ui";
export type VehicleDraftPayload = Record<string, unknown> & { step?: number };
export function VehicleDraftToolbar({
  draftKey,
  storageKey,
  enabled,
  published,
  snapshot,
  restore,
  disabled,
  onSavingChange,
}: {
  draftKey: string;
  storageKey: string;
  enabled: boolean;
  published: boolean;
  snapshot: () => VehicleDraftPayload;
  restore: (value: VehicleDraftPayload) => void;
  disabled: boolean;
  onSavingChange: (saving: boolean) => void;
}) {
  const {
    draft,
    status,
    note,
    save,
    resumed,
    confirmDialog: saveConfirmDialog,
  } = useVehicleDraftAutosave({
    draftKey,
    storageKey,
    snapshot,
    enabled,
    disabled,
    published,
    onSavingChange,
  });
  const pending = status === "pending";
  const [confirmAction, confirmDialog] = useConfirmDialog();
  return (
    <div className="space-y-2 border border-white/10 bg-ink/50 p-3 sm:space-y-3 sm:p-4">
      {confirmDialog}
      {saveConfirmDialog}
      <p className="hidden text-sm leading-relaxed text-muted sm:block">
        O preenchimento é guardado automaticamente como rascunho privado. Só
        salvar o anúncio atualiza a vitrine.
      </p>
      <p className="text-xs text-muted sm:hidden">
        Rascunho privado · não publica o anúncio
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || pending}
          onClick={save}
          className={`${btn.outline} flex-1 sm:flex-none`}
        >
          {pending
            ? "Salvando rascunho…"
            : status === "error" || status === "conflict"
              ? "Tentar salvar rascunho"
              : "Guardar rascunho"}
        </button>
        {draft ? (
          <button
            type="button"
            disabled={disabled || pending}
            className={`${btn.ghost} flex-1 sm:flex-none`}
            onClick={async () => {
              const ok = await confirmAction({
                title: "Retomar o rascunho guardado?",
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
