"use client";

import { useEffect, useRef, useState } from "react";
import { handleFocusTrap } from "@/lib/focus-trap";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = true,
  loading = false,
  typedPhrase,
  typedLabel,
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
  typedPhrase?: string;
  typedLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const [typed, setTyped] = useState("");

  const needsPhrase = Boolean(typedPhrase);
  const expected = (typedPhrase ?? "").trim().toLocaleUpperCase("pt-BR");
  const phraseOk =
    !needsPhrase || typed.trim().toLocaleUpperCase("pt-BR") === expected;

  useEffect(() => {
    if (!open) {
      setTyped("");
      return;
    }
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstInput = panel?.querySelector<HTMLElement>(
      needsPhrase ? "input" : "button",
    );
    firstInput?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (panel) handleFocusTrap(event, panel);
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      lastFocusRef.current?.focus();
    };
  }, [open, onCancel, needsPhrase]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-asphalt/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md border border-white/10 bg-ink shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-1 bg-brand-gradient" aria-hidden="true" />
        <div className="p-6">
          <h2
            id="confirm-dialog-title"
            className="font-display text-xl font-semibold tracking-tight text-cream"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-2 text-sm text-muted">{description}</p>
          ) : null}
          {needsPhrase ? (
            <label className="mt-4 block">
              <span className="text-xs uppercase tracking-wider text-muted">
                {typedLabel ?? `Digite ${typedPhrase} para confirmar`}
              </span>
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && phraseOk && !loading) {
                    event.preventDefault();
                    onConfirm();
                  }
                }}
                autoComplete="off"
                spellCheck={false}
                className="mt-2 min-h-[44px] w-full border border-white/10 bg-asphalt px-3 py-2.5 text-base text-cream outline-none focus:border-brand"
              />
            </label>
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
              disabled={loading || !phraseOk}
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
