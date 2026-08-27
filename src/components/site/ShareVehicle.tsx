"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IconWhatsApp } from "@/components/site/icons";
import { site, whatsappUrl } from "@/lib/site";

type Props = {
  title: string;
  path: string;
  className?: string;
};

/**
 * Compartilhar anúncio: copiar link, WhatsApp e atalho Instagram (copia + abre).
 */
export function ShareVehicle({ title, path, className = "" }: Props) {
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
      toast.success("Link copiado");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
        return;
      } catch {
        /* usuário cancelou ou indisponível */
      }
    }
    await copyLink();
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="sr-only">Compartilhar anúncio</span>
      <span className="text-xs uppercase tracking-wider text-muted" aria-hidden="true">
        Compartilhar
      </span>
      <button
        type="button"
        onClick={nativeShare}
        aria-label="Copiar link do anúncio"
        className="inline-flex min-h-[44px] items-center border border-white/15 px-3 text-xs font-medium text-cream transition hover:border-brand touch-manipulation"
      >
        {copied ? "Copiado" : "Copiar link"}
      </button>
      <a
        href={whatsappUrl(`${text}\n${url}`)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center gap-1.5 border border-white/15 px-3 text-xs font-medium text-cream transition hover:border-brand touch-manipulation"
      >
        <IconWhatsApp className="h-3.5 w-3.5" />
        WhatsApp
      </a>
      <button
        type="button"
        onClick={async () => {
          await copyLink();
          window.open(site.instagramUrl, "_blank", "noopener,noreferrer");
        }}
        className="inline-flex min-h-[44px] items-center border border-white/15 px-3 text-xs font-medium text-cream transition hover:border-brand touch-manipulation"
      >
        Instagram
      </button>
    </div>
  );
}
