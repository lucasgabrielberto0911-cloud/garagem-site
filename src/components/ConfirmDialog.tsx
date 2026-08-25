"use client";

import { useEffect } from "react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-asphalt/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md border border-white/10 bg-ink shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-1 bg-brand-gradient" aria-hidden="true" />
        <div className="p-6">
          <h2 className="font-display text-xl font-semibold tracking-tight text-cream">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 text-sm text-muted">{description}</p>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="min-h-[44px] border border-white/15 px-4 py-2 text-sm text-muted transition touch-manipulation hover:text-cream disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`min-h-[44px] px-4 py-2 text-sm font-medium text-cream transition touch-manipulation disabled:opacity-60 ${
                danger ? "bg-brand hover:bg-[#c91418]" : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {loading ? "Aguarde..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
