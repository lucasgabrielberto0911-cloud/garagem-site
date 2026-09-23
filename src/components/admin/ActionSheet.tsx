"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "@/components/site/icons";
import { handleFocusTrap } from "@/lib/focus-trap";

/**
 * Menu de ações: folha que sobe do rodapé no celular (alcance do polegar) e
 * caixa central no desktop. Junta ações secundárias sem lotar o card.
 */
export function ActionSheet({
  open,
  title,
  subtitle,
  media,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  media?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const lastFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("[data-sheet-item]:not([disabled])")?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (panel) handleFocusTrap(event, panel);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (lastFocus?.isConnected) lastFocus.focus();
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 bg-asphalt/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className="relative w-full max-w-md border-t border-white/10 bg-ink pb-safe shadow-2xl animate-slide-up sm:border sm:pb-0"
      >
        <div className="flex items-center gap-3 border-b border-white/10 py-2 pl-4 pr-2">
          {media}
          <div className="min-w-0 flex-1">
            <p
              id={titleId}
              className="truncate font-display text-sm font-semibold uppercase tracking-wider text-cream"
            >
              {title}
            </p>
            {subtitle ? (
              <p className="truncate text-xs text-muted">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-muted transition touch-manipulation hover:text-cream"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto overscroll-contain py-1">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const ITEM =
  "flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-sm transition touch-manipulation hover:bg-white/5 active:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";

const TONE = {
  default: "text-cream",
  danger: "text-brand",
  warning: "text-brand-orange",
} as const;

type ItemTone = keyof typeof TONE;

function ItemBody({ icon, label, hint }: { icon?: ReactNode; label: string; hint?: string }) {
  return (
    <>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {hint ? <span className="block truncate text-xs text-muted">{hint}</span> : null}
      </span>
    </>
  );
}

export function ActionSheetButton({
  icon,
  label,
  hint,
  onClick,
  disabled = false,
  tone = "default",
}: {
  icon?: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: ItemTone;
}) {
  return (
    <button
      type="button"
      data-sheet-item
      disabled={disabled}
      onClick={onClick}
      className={`${ITEM} ${TONE[tone]}`}
    >
      <ItemBody icon={icon} label={label} hint={hint} />
    </button>
  );
}

export function ActionSheetLink({
  icon,
  label,
  hint,
  href,
  external = false,
  onNavigate,
}: {
  icon?: ReactNode;
  label: string;
  hint?: string;
  href: string;
  external?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      data-sheet-item
      target={external ? "_blank" : undefined}
      onClick={onNavigate}
      className={`${ITEM} ${TONE.default}`}
    >
      <ItemBody icon={icon} label={label} hint={hint} />
    </Link>
  );
}
