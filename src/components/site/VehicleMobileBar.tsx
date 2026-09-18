"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { VehicleLeadHit } from "@/components/site/VehiclePixel";
import { IconWhatsApp } from "@/components/site/icons";
import { formatCurrencyBRL } from "@/lib/format";
import { trackWhatsAppClick } from "@/lib/meta-pixel";
import { queueWhatsAppIfOffline } from "@/lib/offline-whatsapp";
import {
  WHATSAPP_MESSAGES,
  fichaWhatsAppTracking,
  whatsappUrl,
} from "@/lib/site";

function openWhatsApp(
  event: React.MouseEvent<HTMLAnchorElement>,
  href: string,
  label: string,
  vehicleId: string,
) {
  trackWhatsAppClick(label);
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    event.preventDefault();
    void queueWhatsAppIfOffline({
      url: href,
      label,
      vehicleId,
    });
  }
}

/** Barra fixa no mobile: um CTA primário; Simular/Troca/Vídeo em “Mais opções”. */
export function VehicleMobileBar({
  vehicleId,
  vehiclePath,
  contentName,
  message,
  videoMessage,
  financeMessage,
  tradeMessage,
  brand,
  model,
  year,
  price,
  sold = false,
  category,
  soldHref = "/estoque",
  soldLabel = "Ver estoque",
}: {
  vehicleId: string;
  vehiclePath?: string;
  contentName: string;
  message?: string;
  videoMessage?: string;
  financeMessage?: string;
  tradeMessage?: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  sold?: boolean;
  category?: string;
  soldHref?: string;
  soldLabel?: string;
}) {
  const isMoto = category === "moto";
  const moreId = useId();
  const [moreOpen, setMoreOpen] = useState(false);
  const track = fichaWhatsAppTracking({ id: vehicleId, path: vehiclePath });
  const href = whatsappUrl(
    message ?? WHATSAPP_MESSAGES.vehicle(contentName, isMoto),
    track,
  );
  const financeHref = financeMessage ? whatsappUrl(financeMessage, track) : null;
  const tradeHref = tradeMessage ? whatsappUrl(tradeMessage, track) : null;
  const videoHref = videoMessage ? whatsappUrl(videoMessage, track) : null;
  const secondary = [
    financeHref
      ? { href: financeHref, label: "Simular", tracking: "ficha-finance" }
      : null,
    tradeHref
      ? { href: tradeHref, label: "Troca", tracking: "ficha-trade" }
      : null,
    videoHref
      ? { href: videoHref, label: "Vídeo", tracking: "ficha-video" }
      : null,
  ].filter(Boolean) as Array<{ href: string; label: string; tracking: string }>;

  useEffect(() => {
    if (!moreOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  return (
    <div
      data-vehicle-mobile-bar=""
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-asphalt/95 px-3 pt-2 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-safe pr-safe lg:hidden"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 pl-0.5">
            <p className="truncate text-xs text-muted">
              {sold ? "Já vendido" : `${brand} ${model} · ${year}`}
            </p>
            <p className="font-display text-xl font-bold leading-tight text-cream">
              {sold ? "Indisponível" : formatCurrencyBRL(price)}
            </p>
            {!sold && secondary.length > 0 ? (
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-controls={moreId}
                onClick={() => setMoreOpen((open) => !open)}
                className="mt-0.5 min-h-8 text-left font-display text-[11px] font-semibold text-muted underline-offset-2 transition hover:text-cream hover:underline touch-manipulation"
              >
                Mais opções
              </button>
            ) : null}
          </div>

          {sold ? (
            <Link
              href={soldHref}
              className="inline-flex min-h-[48px] shrink-0 items-center justify-center bg-brand px-5 py-3 font-display text-sm font-semibold text-asphalt touch-manipulation"
            >
              {soldLabel}
            </Link>
          ) : (
            <VehicleLeadHit
              contentId={vehicleId}
              contentName={contentName}
              value={price}
              make={brand}
              model={model}
              year={year}
            >
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) =>
                  openWhatsApp(event, href, "ficha-mobile", vehicleId)
                }
                className="whatsapp-btn inline-flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 px-3 py-3 font-display text-xs font-semibold text-white touch-manipulation sm:px-4 sm:text-sm"
              >
                <IconWhatsApp className="h-4 w-4" />
                Tenho interesse
              </a>
            </VehicleLeadHit>
          )}
        </div>

        {!sold && moreOpen && secondary.length > 0 ? (
          <div
            id={moreId}
            className="mt-2 grid grid-cols-3 gap-1.5 border-t border-white/10 pt-2"
          >
            {secondary.map((action) => (
              <a
                key={action.tracking}
                href={action.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  setMoreOpen(false);
                  openWhatsApp(event, action.href, action.tracking, vehicleId);
                }}
                className="inline-flex min-h-11 items-center justify-center px-1 text-center font-display text-[11px] font-semibold text-cream underline-offset-2 transition hover:underline touch-manipulation"
              >
                {action.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
