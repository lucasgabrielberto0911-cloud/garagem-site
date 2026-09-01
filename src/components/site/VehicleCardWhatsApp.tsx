"use client";

import { VehicleLeadHit } from "@/components/site/VehiclePixel";
import { IconWhatsApp } from "@/components/site/icons";
import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";

/**
 * Atalho de conversão no card: o interessado fala no WhatsApp sem abrir a ficha.
 * Fica fora do link do anúncio para não misturar navegação e lead.
 */
export function VehicleCardWhatsApp({
  vehicleId,
  label,
  value,
  make,
  model,
  year,
}: {
  vehicleId: string;
  label: string;
  value: number;
  make: string;
  model: string;
  year: number;
}) {
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
        href={whatsappUrl(WHATSAPP_MESSAGES.vehicle(label))}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Tenho interesse no ${label} pelo WhatsApp`}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 border-t border-white/10 bg-ink px-2 font-display text-[11px] font-semibold uppercase tracking-wide text-cream transition touch-manipulation hover:bg-white/5 hover:text-brand"
      >
        <IconWhatsApp className="h-3.5 w-3.5 text-[#25D366]" />
        WhatsApp
      </a>
    </VehicleLeadHit>
  );
}
