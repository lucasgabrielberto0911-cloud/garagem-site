"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  readStoredConsent,
  writeStoredConsent,
  type ConsentChoice,
} from "@/lib/consent";

function isListingGridPath(pathname: string | null) {
  if (!pathname) return false;
  return (
    pathname === "/" ||
    pathname === "/estoque" ||
    pathname === "/favoritos" ||
    pathname.startsWith("/marca/") ||
    pathname.startsWith("/modelo/") ||
    pathname.startsWith("/seminovos") ||
    pathname.startsWith("/guia")
  );
}

export function CookieConsent() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<ConsentChoice | null | "pending">(
    "pending",
  );

  useEffect(() => {
    const stored = readStoredConsent();
    document.documentElement.dataset.consent = stored ?? "pending";
    setChoice(stored);
  }, []);

  if (choice && choice !== "pending") return null;

  const isFicha = Boolean(pathname && /^\/estoque\/[^/]+/.test(pathname));
  // Na ficha o globals.css já fixa no canto inferior direito sem WhatsAppFloat/chat.
  // Nas listagens os botões flutuantes ficam empilhados à direita (right-6); nas demais páginas o launcher fica à esquerda do WhatsApp.
  const desktopPositionClass = isFicha
    ? ""
    : isListingGridPath(pathname)
      ? "lg:!left-auto lg:!right-24 lg:!bottom-6"
      : "lg:!left-auto lg:!right-24 lg:!bottom-24";

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className={`site-consent pointer-events-auto flex flex-col gap-1 border border-white/20 bg-ink/95 px-2.5 py-1 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur sm:gap-2 sm:px-3.5 sm:py-3 ${desktopPositionClass}`}
    >
      <p className="text-xs leading-tight text-cream sm:text-[13px] sm:leading-snug">
        Usamos cookies para medir visitas e anúncios. Aceita?{" "}
        <Link
          href="/privacidade"
          prefetch={false}
          className="font-medium text-cream underline decoration-white/60 underline-offset-2 transition hover:text-brand-light"
        >
          Privacidade
        </Link>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            writeStoredConsent("accepted");
            setChoice("accepted");
          }}
          className="inline-flex min-h-11 items-center justify-center bg-brand-dark px-2.5 text-center font-display text-xs font-semibold uppercase leading-tight tracking-wide text-cream transition hover:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-ink touch-manipulation"
        >
          Aceitar
        </button>
        <button
          type="button"
          onClick={() => {
            writeStoredConsent("essential");
            setChoice("essential");
          }}
          className="inline-flex min-h-11 items-center justify-center border border-white/25 bg-white/[0.04] px-2.5 text-center font-display text-xs font-semibold uppercase leading-tight tracking-wide text-cream transition hover:border-white/45 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-ink touch-manipulation"
        >
          Só o essencial
        </button>
      </div>
    </div>
  );
}
