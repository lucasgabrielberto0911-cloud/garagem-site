"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { IconClose, IconWhatsApp } from "@/components/site/icons";
import { whatsappUrl } from "@/lib/site";

/**
 * Float só no desktop/tablet largo — no mobile o WhatsApp já está na bottom nav.
 * Posição: canto inferior direito. BackToTop fica acima; InstallPrompt à esquerda.
 */
export function WhatsAppFloat() {
  const pathname = usePathname() || "/";
  const [show, setShow] = useState(false);
  const [tooltip, setTooltip] = useState(false);

  const hide =
    pathname.startsWith("/admin") || pathname.startsWith("/estoque/");

  useEffect(() => {
    const showTimer = window.setTimeout(() => setShow(true), 2800);
    const tipTimer = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem("garagem:wa-tip") !== "1") {
          setTooltip(true);
        }
      } catch {
        setTooltip(true);
      }
    }, 8000);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(tipTimer);
    };
  }, []);

  if (!show || hide) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 hidden flex-col items-end gap-3 lg:flex">
      {tooltip ? (
        <div className="pointer-events-auto animate-fade-in relative max-w-[220px] border border-white/10 bg-ink p-4 shadow-xl">
          <button
            type="button"
            onClick={() => {
              setTooltip(false);
              try {
                window.localStorage.setItem("garagem:wa-tip", "1");
              } catch {
                /* ignore */
              }
            }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center text-muted transition hover:text-cream"
            aria-label="Fechar dica"
          >
            <IconClose className="h-3.5 w-3.5" />
          </button>
          <p className="pr-6 font-display text-sm font-semibold text-cream">
            Olá!
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Posso te ajudar a encontrar o carro ideal?
          </p>
        </div>
      ) : null}

      <a
        href={whatsappUrl()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir WhatsApp"
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 active:scale-95 touch-manipulation"
      >
        <IconWhatsApp className="h-7 w-7" />
      </a>
    </div>
  );
}
