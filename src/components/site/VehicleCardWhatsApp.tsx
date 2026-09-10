"use client";

import { VehicleLeadHit } from "@/components/site/VehiclePixel";
import { IconWhatsApp } from "@/components/site/icons";
import { trackWhatsAppClick } from "@/lib/meta-pixel";
import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";

/**
 * Atalho de conversão no card: o interessado fala no WhatsApp sem abrir a ficha.
 * Fica fora do link do anúncio para não misturar navegação e lead.
 */
export function VehicleCardWhatsApp({
  vehicleId,
  label,
  message,
  value,
  make,
  model,
  year,
  className = "",
  variant = "bar",
  trackingLabel = "vehicle-card",
}: {
  vehicleId: string;
  label: string;
  message?: string;
  value: number;
  make: string;
  model: string;
  year: number;
  className?: string;
  variant?: "bar" | "icon";
  trackingLabel?: string;
}) {
  const icon = variant === "icon";
  const text = message ?? WHATSAPP_MESSAGES.vehicle(label);
  return (
    <VehicleLeadHit
      contentId={vehicleId}
      contentName={label}
      value={value}
      make={make}
      model={model}
      year={year}
    >
      <a
        href={whatsappUrl(text)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsAppClick(trackingLabel)}
        aria-label={`Tenho interesse no ${label} pelo WhatsApp`}
        className={
          icon
            ? `inline-flex min-h-11 w-11 shrink-0 flex-col items-center justify-center self-stretch border-l border-white/10 bg-[#101612] text-[#25D366] transition touch-manipulation hover:bg-[#14301c] ${className}`
            : `inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 border-t border-white/10 bg-[#101612] px-2 font-display text-[11px] font-semibold uppercase tracking-wide text-cream transition touch-manipulation hover:bg-[#14301c] ${className}`
        }
      >
        <IconWhatsApp
          className={icon ? "h-5 w-5 text-[#25D366]" : "h-3.5 w-3.5 text-[#25D366]"}
        />
        {icon ? <span className="sr-only">Tenho interesse</span> : "Tenho interesse"}
      </a>
    </VehicleLeadHit>
  );
}
