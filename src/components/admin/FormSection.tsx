"use client";

import { useId, type ReactNode } from "react";
import { IconChevronDown } from "@/components/admin/icons";

/**
 * Card colapsável do formulário. Fechado, o conteúdo só fica escondido (não
 * desmonta): os campos continuam no FormData e o valor não se perde.
 */
export function FormSection({
  id,
  title,
  summary,
  open,
  onToggle,
  action,
  errorCount = 0,
  children,
}: {
  id: string;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  errorCount?: number;
  children: ReactNode;
}) {
  const contentId = useId();

  return (
    <section
      id={id}
      className={`scroll-mt-admin-form border bg-ink/50 ${
        errorCount > 0 ? "border-brand/50" : "border-white/10"
      }`}
    >
      <div className="flex items-stretch">
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={onToggle}
            className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left transition touch-manipulation hover:bg-white/[0.03] sm:px-5"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
                  {title}
                </span>
                {errorCount > 0 ? (
                  <span className="bg-brand px-1.5 py-0.5 font-display text-[10px] font-bold text-cream">
                    {errorCount === 1 ? "1 erro" : `${errorCount} erros`}
                  </span>
                ) : null}
              </span>
              {!open && summary ? (
                <span className="mt-0.5 block truncate text-xs text-muted">
                  {summary}
                </span>
              ) : null}
            </span>
            <IconChevronDown
              className={`h-5 w-5 shrink-0 text-muted transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </h2>
        {open && action ? (
          <div className="hidden items-center pr-4 sm:flex sm:pr-5">{action}</div>
        ) : null}
      </div>
      <div
        id={contentId}
        hidden={!open}
        className="border-t border-white/10 p-4 sm:p-5"
      >
        {children}
      </div>
    </section>
  );
}
