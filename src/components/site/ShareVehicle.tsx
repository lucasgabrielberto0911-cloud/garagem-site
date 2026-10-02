"use client";

import { useState } from "react";
import { notifyError, notifySuccess } from "@/lib/notify";
import { IconWhatsApp } from "@/components/site/icons";
import { trackWhatsAppClick } from "@/lib/meta-pixel";
import { site, whatsappContentFromVehicle, whatsappUrl } from "@/lib/site";

type Props = {
  title: string;
  path: string;
  vehicleId?: string;
  className?: string;
};

/**
 * Compartilhar anúncio: copiar link, WhatsApp e atalho Instagram (copia + abre).
 */
export function ShareVehicle({ title, path, vehicleId, className = "" }: Props) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}${path}`
      : `${site.url}${path}`;
  const text = `${title} — disponível na ${site.name}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      notifySuccess("Link copiado");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notifyError("Não foi possível copiar o link");
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="sr-only">Compartilhar anúncio</span>
      <span className="text-xs uppercase tracking-wider text-muted" aria-hidden="true">
        Compartilhar
      </span>
      <button
        type="button"
        onClick={copyLink}
        aria-label="Copiar link do anúncio"
        className="inline-flex min-h-[44px] items-center border border-white/15 px-3 text-xs font-medium text-cream transition hover:border-brand touch-manipulation"
      >
        {copied ? "Copiado" : "Copiar link"}
      </button>
      <a
        href={whatsappUrl(`${text}\n${url}`, { bare: true })}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackWhatsAppClick("ficha-share", {
            vehicleId,
            slug: whatsappContentFromVehicle({ id: vehicleId, path }),
          })
        }
        className="inline-flex min-h-[44px] items-center gap-1.5 border border-white/15 px-3 text-xs font-medium text-cream transition hover:border-brand touch-manipulation"
      >
        <IconWhatsApp className="h-3.5 w-3.5" />
        WhatsApp
      </a>
      <a
        href={site.instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={copyLink}
        className="inline-flex min-h-[44px] items-center border border-white/15 px-3 text-xs font-medium text-cream transition hover:border-brand touch-manipulation"
      >
        Instagram
      </a>
    </div>
  );
}
