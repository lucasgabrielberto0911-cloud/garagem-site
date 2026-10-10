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
  slug?: string,
) {
  trackWhatsAppClick(label, { vehicleId, slug });
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    event.preventDefault();
    void queueWhatsAppIfOffline({
      url: event.currentTarget.href || href,
      label,
      vehicleId,
    });
  }
}

/**
 * Barra fixa no mobile, sempre visível. A altura está em `--ficha-sticky-bar`
 * para a primeira dobra reservar o espaço e a foto não ficar por baixo.
 * Simular, troca e vídeo sobem por cima da barra, sem empurrar o layout.
 */
export function VehicleMobileBar({
  vehicleId,
  vehicleSlug,
  vehiclePath,
  contentName,
  message,
  videoMessage,
  financeMessage,
  tradeMessage,
  visitMessage,
  brand,
  model,
  year,
  price,
  stateOfVehicle,
  exteriorColor,
  catalogTransmission,
  bodyStyle,
  fuelType,
  postalCode,
  sold = false,
  category,
  soldHref = "/estoque",
  soldLabel = "Ver estoque",
}: {
  vehicleId: string;
  vehicleSlug?: string;
  vehiclePath?: string;
  contentName: string;
  message?: string;
  videoMessage?: string;
  financeMessage?: string;
  tradeMessage?: string;
  /** Mensagem pronta `intent: "visit"`; sem ela a ação não aparece. */
  visitMessage?: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  stateOfVehicle?: string;
  exteriorColor?: string;
  catalogTransmission?: string;
  bodyStyle?: string;
  fuelType?: string;
  postalCode?: string;
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
  const visitHref = visitMessage ? whatsappUrl(visitMessage, track) : null;
  const secondary = [
    financeHref
      ? {
          href: financeHref,
          label: "Simular",
          tracking: "ficha-finance",
          aria: "Simular parcelas deste veículo no WhatsApp",
        }
      : null,
    tradeHref
      ? {
          href: tradeHref,
          label: "Troca",
          tracking: "ficha-trade",
          aria: "Avaliar uma troca deste veículo no WhatsApp",
        }
      : null,
    videoHref
      ? {
          href: videoHref,
          label: "Vídeo",
          tracking: "ficha-video",
          aria: "Pedir vídeo deste veículo no WhatsApp",
        }
      : null,
  ].filter(Boolean) as Array<{
    href: string;
    label: string;
    tracking: string;
    aria: string;
  }>;

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
      className="fixed inset-x-0 bottom-0 z-40 box-border min-h-[var(--ficha-sticky-bar)] border-t border-white/15 bg-asphalt px-3 pt-2 pb-[env(safe-area-inset-bottom,0px)] pl-safe pr-safe lg:hidden"
    >
      <div className="relative mx-auto max-w-6xl">
        {!sold && moreOpen && secondary.length > 0 ? (
          <div
            id={moreId}
            className="absolute inset-x-0 bottom-full mb-2 grid grid-cols-3 gap-1.5 border border-white/15 bg-asphalt px-2 py-2 shadow-[0_-12px_30px_rgba(0,0,0,0.35)]"
          >
            {secondary.map((action) => (
              <VehicleLeadHit
                key={action.tracking}
                contentId={vehicleId}
                contentName={contentName}
                value={price}
                make={brand}
                model={model}
                year={year}
                stateOfVehicle={stateOfVehicle}
                exteriorColor={exteriorColor}
                transmission={catalogTransmission}
                bodyStyle={bodyStyle}
                fuelType={fuelType}
                postalCode={postalCode}
              >
                <a
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={action.aria}
                  onClick={(event) => {
                    setMoreOpen(false);
                    openWhatsApp(
                      event,
                      action.href,
                      action.tracking,
                      vehicleId,
                      vehicleSlug,
                    );
                  }}
                  className="inline-flex min-h-11 items-center justify-center px-1 text-center font-display text-[11px] font-semibold text-cream underline-offset-2 transition hover:underline active:underline touch-manipulation"
                >
                  {action.label}
                </a>
              </VehicleLeadHit>
            ))}
          </div>
        ) : null}

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
                className="mt-0.5 min-h-11 text-left font-display text-[11px] font-semibold text-muted underline-offset-2 transition hover:text-cream hover:underline active:text-cream active:underline touch-manipulation"
              >
                {moreOpen ? "Fechar opções" : "Simular / troca / vídeo"}
              </button>
            ) : null}
          </div>

          {sold ? (
            <Link
              href={soldHref}
              prefetch={false}
              className="inline-flex min-h-12 shrink-0 items-center justify-center bg-brand px-5 py-3 font-display text-sm font-semibold text-asphalt touch-manipulation"
            >
              {soldLabel}
            </Link>
          ) : (
            <div className="flex shrink-0 flex-col items-stretch gap-0.5">
              <VehicleLeadHit
                contentId={vehicleId}
                contentName={contentName}
                value={price}
                make={brand}
                model={model}
                year={year}
                stateOfVehicle={stateOfVehicle}
                exteriorColor={exteriorColor}
                transmission={catalogTransmission}
                bodyStyle={bodyStyle}
                fuelType={fuelType}
                postalCode={postalCode}
              >
                <a
                  id="ficha-whatsapp"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir WhatsApp sobre ${contentName}`}
                  onClick={(event) =>
                    openWhatsApp(event, href, "ficha-mobile", vehicleId, vehicleSlug)
                  }
                  className="inline-flex min-h-12 shrink-0 items-center justify-center gap-1.5 bg-brand px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-cream touch-manipulation hover:bg-[#c91418] sm:px-4 sm:text-sm"
                >
                  <IconWhatsApp className="h-4 w-4" />
                  <span className="text-left leading-tight">
                    Tenho interesse
                    <span className="mt-0.5 block text-[9px] font-medium normal-case tracking-normal text-cream/80">
                      no WhatsApp
                    </span>
                  </span>
                </a>
              </VehicleLeadHit>
              {visitHref ? (
                <VehicleLeadHit
                  contentId={vehicleId}
                  contentName={contentName}
                  value={price}
                  make={brand}
                  model={model}
                  year={year}
                  stateOfVehicle={stateOfVehicle}
                  exteriorColor={exteriorColor}
                  transmission={catalogTransmission}
                  bodyStyle={bodyStyle}
                  fuelType={fuelType}
                  postalCode={postalCode}
                >
                  <a
                    href={visitHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Agendar visita: combinar dia e hora pelo WhatsApp"
                    onClick={(event) =>
                      openWhatsApp(
                        event,
                        visitHref,
                        "ficha-visit",
                        vehicleId,
                        vehicleSlug,
                      )
                    }
                    className="inline-flex min-h-[38px] w-full items-center justify-center border border-white/25 px-3 font-display text-[11px] font-semibold uppercase tracking-wide text-cream touch-manipulation transition hover:border-white/50 active:border-white/50"
                  >
                    Agendar visita
                  </a>
                </VehicleLeadHit>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
