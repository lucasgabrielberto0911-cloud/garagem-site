"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconChat, IconClose, IconWhatsApp } from "@/components/site/icons";
import { usePageWhatsAppTarget } from "@/components/site/usePageWhatsAppHref";
import { SITE_CHAT_OPEN_EVENT } from "@/lib/chat-open";
import { trackCatalogWhatsAppClick, trackWhatsAppClick } from "@/lib/meta-pixel";

/**
 * Botão flutuante único no desktop: abre um mini-menu com "Falar no WhatsApp"
 * e "Perguntar ao assistente", liberando a 1ª dobra dos cards e o aviso de cookies.
 * No celular e na ficha o wrapper `.site-chat:not(.is-open)` fica oculto via CSS.
 */
export function SiteSupportFloat({
  onOpenAssistant,
  busy = false,
}: {
  onOpenAssistant: () => void;
  busy?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const whatsapp = usePageWhatsAppTarget();

  useEffect(() => {
    const close = () => setMenuOpen(false);
    window.addEventListener(SITE_CHAT_OPEN_EVENT, close);
    return () => window.removeEventListener(SITE_CHAT_OPEN_EVENT, close);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div ref={rootRef} className="pointer-events-none flex flex-col items-end">
      {menuOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Opções de atendimento"
          className="pointer-events-auto mb-2.5 flex w-60 flex-col gap-1.5 rounded-xl border border-white/20 bg-ink/95 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
        >
          <a
            role="menuitem"
            href={whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackWhatsAppClick("float", {
                vehicleId: whatsapp.vehicleId,
                slug: whatsapp.slug,
              });
              trackCatalogWhatsAppClick(whatsapp.catalogParams);
              setMenuOpen(false);
            }}
            className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 font-display text-sm font-semibold text-cream transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream touch-manipulation"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-asphalt">
              <IconWhatsApp className="h-4 w-4" />
            </span>
            <span>Falar no WhatsApp</span>
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onOpenAssistant();
            }}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-display text-sm font-semibold text-cream transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream touch-manipulation"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <IconChat className="h-4 w-4" />
            </span>
            <span>Perguntar ao assistente</span>
          </button>
        </div>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-controls={menuOpen ? menuId : undefined}
        aria-label={
          menuOpen
            ? "Fechar opções de atendimento"
            : "Atendimento: WhatsApp ou assistente"
        }
        aria-busy={busy}
        className="site-chat-launcher pointer-events-auto relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gradient-to-b from-[#E8181C] to-[#B91216] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_12px_28px_-8px_rgba(232,24,28,0.65),0_2px_6px_rgba(0,0,0,0.45)] ring-1 ring-white/25 transition hover:-translate-y-0.5 hover:from-[#F0282C] hover:to-[#C91418] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt touch-manipulation"
      >
        {menuOpen ? (
          <IconClose className="h-5 w-5" />
        ) : (
          <>
            <IconChat className="h-5 w-5" />
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-[#25D366] ring-2 ring-asphalt"
            />
          </>
        )}
      </button>
    </div>
  );
}
