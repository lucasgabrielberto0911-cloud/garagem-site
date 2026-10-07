"use client";

import { useState } from "react";
import { notifyError, notifySuccess } from "@/lib/notify";
import { canonicalVehicleShareUrl, shareVehicleLink } from "@/lib/vehicle-share";
import { site } from "@/lib/site";

type Props = { title: string; path: string; vehicleId?: string; className?: string };
const buttonClass = "inline-flex min-h-[44px] items-center justify-center border border-white/15 px-3 text-xs font-medium text-cream transition hover:border-brand touch-manipulation disabled:opacity-60";

export function ShareVehicle({ title, path, className = "" }: Props) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // O link compartilhado é sempre o anúncio público, mesmo em uma prévia.
  const url = canonicalVehicleShareUrl(site.url, path);
  const copied = copiedUrl === url;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      notifySuccess("Link copiado");
    } catch {
      notifyError("Não foi possível copiar o link. Tente novamente.");
    }
  }

  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await shareVehicleLink(navigator, { title, text: `${title} — ${site.name}`, url });
      if (outcome === "copied") {
        setCopiedUrl(url);
        notifySuccess("Link copiado para você compartilhar");
      }
    } catch {
      notifyError("Não foi possível compartilhar. Você pode usar Copiar link.");
    } finally { setBusy(false); }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button type="button" onClick={() => void share()} disabled={busy} aria-busy={busy}
        className={buttonClass + " border-white/25"}>
        Compartilhar anúncio
      </button>
      <button type="button" onClick={() => void copyLink()} aria-label="Copiar link do anúncio" className={buttonClass}>
        {copied ? "Link copiado" : "Copiar link"}
      </button>
    </div>
  );
}
