"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  readStoredConsent,
  writeStoredConsent,
  type ConsentChoice,
} from "@/lib/consent";

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
  // Na ficha o globals.css fixa no canto inferior direito (fora da galeria).
  // Nas demais páginas desktop vira faixa horizontal compacta antes do botão único
  // de atendimento, sem invadir a barra lateral de filtros nem os botões "Salvar".
  const desktopLayoutClass = isFicha
    ? ""
    : "lg:flex-row lg:items-center lg:gap-3 lg:px-3 lg:py-1.5";
  const buttonGroupClass = isFicha
    ? "grid grid-cols-2 gap-2"
    : "grid grid-cols-2 gap-2 lg:flex lg:shrink-0 lg:items-center";
  const buttonHeightClass = isFicha ? "min-h-11" : "min-h-11 lg:min-h-9";

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className={`site-consent pointer-events-auto flex flex-col gap-1 border border-white/20 bg-ink/95 px-2.5 py-1 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur sm:gap-2 sm:px-3.5 sm:py-3 ${desktopLayoutClass}`}
    >
      <p
        className={`text-xs leading-tight text-cream sm:text-[13px] sm:leading-snug${
          isFicha ? "" : " lg:whitespace-nowrap"
        }`}
      >
        Usamos cookies para medir visitas e anúncios. Aceita?{" "}
        <Link
          href="/privacidade"
          prefetch={false}
          className="font-medium text-cream underline decoration-white/60 underline-offset-2 transition hover:text-brand-light"
        >
          Privacidade
        </Link>
      </p>
      <div className={buttonGroupClass}>
        <button
          type="button"
          onClick={() => {
            writeStoredConsent("accepted");
            setChoice("accepted");
          }}
          className={`inline-flex ${buttonHeightClass} items-center justify-center whitespace-nowrap bg-brand-dark px-2.5 text-center font-display text-xs font-semibold uppercase leading-tight tracking-wide text-cream transition hover:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-ink touch-manipulation`}
        >
          Aceitar
        </button>
        <button
          type="button"
          onClick={() => {
            writeStoredConsent("essential");
            setChoice("essential");
          }}
          className={`inline-flex ${buttonHeightClass} items-center justify-center whitespace-nowrap border border-white/25 bg-white/[0.04] px-2.5 text-center font-display text-xs font-semibold uppercase leading-tight tracking-wide text-cream transition hover:border-white/45 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-ink touch-manipulation`}
        >
          Só o essencial
        </button>
      </div>
    </div>
  );
}
