"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  readStoredConsent,
  writeStoredConsent,
  type ConsentChoice,
} from "@/lib/consent";

export function CookieConsent() {
  const [choice, setChoice] = useState<ConsentChoice | null | "pending">(
    "pending",
  );

  useEffect(() => {
    const stored = readStoredConsent();
    document.documentElement.dataset.consent = stored ?? "pending";
    setChoice(stored);
  }, []);

  if (choice && choice !== "pending") return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="site-consent pointer-events-auto flex flex-col gap-1 border border-white/15 bg-ink/95 px-2.5 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur sm:px-3 sm:py-3"
    >
      <p className="text-xs leading-snug text-cream/90">
        Analytics só com aceite.{" "}
        <Link
          href="/privacidade"
          prefetch={false}
          className="underline decoration-white/40 underline-offset-2 hover:text-brand-light"
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
          className="inline-flex min-h-11 items-center justify-center bg-brand px-2 text-center font-display text-xs font-semibold uppercase leading-tight tracking-wide text-cream"
        >
          Aceitar
        </button>
        <button
          type="button"
          onClick={() => {
            writeStoredConsent("essential");
            setChoice("essential");
          }}
          className="inline-flex min-h-11 items-center justify-center border border-white/20 px-2 text-center font-display text-xs font-semibold uppercase leading-tight tracking-wide text-cream"
        >
          Só o essencial
        </button>
      </div>
    </div>
  );
}
