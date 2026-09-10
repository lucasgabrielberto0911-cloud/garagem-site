"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  hasMarketingConsent,
  readStoredConsent,
  writeStoredConsent,
  type ConsentChoice,
} from "@/lib/consent";

export function CookieConsent() {
  const [choice, setChoice] = useState<ConsentChoice | null | "pending">(
    "pending",
  );

  useEffect(() => {
    setChoice(readStoredConsent());
  }, []);

  if (choice === "pending" || choice) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="site-consent pointer-events-auto fixed z-[55] max-w-[min(22rem,calc(100vw-7.5rem))] border border-white/15 bg-ink/95 px-3 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur"
    >
      <p className="text-[12px] leading-snug text-cream/90">
        Cookies de medição (Google e Meta) só entram com o seu ok. O site, o
        assistente e o WhatsApp funcionam no essencial.{" "}
        <Link
          href="/privacidade"
          className="underline decoration-white/40 underline-offset-2 hover:text-brand"
        >
          Privacidade
        </Link>
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            writeStoredConsent("accepted");
            setChoice("accepted");
          }}
          className="inline-flex min-h-11 items-center bg-brand px-3 font-display text-[11px] font-semibold uppercase tracking-wide text-cream"
        >
          Aceitar
        </button>
        <button
          type="button"
          onClick={() => {
            writeStoredConsent("essential");
            setChoice("essential");
          }}
          className="inline-flex min-h-11 items-center border border-white/20 px-3 font-display text-[11px] font-semibold uppercase tracking-wide text-cream"
        >
          Só o essencial
        </button>
      </div>
      <span className="sr-only">
        {hasMarketingConsent() ? "Medição liberada" : "Medição bloqueada"}
      </span>
    </div>
  );
}
