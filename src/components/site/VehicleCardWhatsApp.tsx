"use client";

import { useHideStockCardInterest } from "@/components/site/HideStockCardInterest";
import { VehicleLeadHit } from "@/components/site/VehiclePixel";
import { IconWhatsApp } from "@/components/site/icons";
import { trackWhatsAppClick } from "@/lib/meta-pixel";
import { queueWhatsAppIfOffline } from "@/lib/offline-whatsapp";
import {
  WHATSAPP_MESSAGES,
  whatsappCampaignFromLabel,
  whatsappContentFromVehicle,
  whatsappUrl,
  type WhatsAppCampaign,
} from "@/lib/site";

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
  path,
  className = "",
  variant = "bar",
  trackingLabel = "vehicle-card",
  campaign,
  showOnStockList = false,
}: {
  vehicleId: string;
  label: string;
  message?: string;
  value: number;
  make: string;
  model: string;
  year: number;
  path?: string;
  className?: string;
  variant?: "bar" | "chat" | "chat-compact";
  trackingLabel?: string;
  campaign?: WhatsAppCampaign;
  /** O novo card mobile reutiliza a barra original mesmo dentro do estoque. */
  showOnStockList?: boolean;
}) {
  const hideOnStockList = useHideStockCardInterest();
  const compact = variant === "chat-compact";
  const chat = variant === "chat" || compact;
  if (hideOnStockList && !chat && !showOnStockList) return null;
  const text = message ?? WHATSAPP_MESSAGES.vehicle(label);
  const content = whatsappContentFromVehicle({ id: vehicleId, path });
  const href = whatsappUrl(text, {
    campaign: campaign ?? whatsappCampaignFromLabel(trackingLabel),
    content,
  });
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
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => {
          trackWhatsAppClick(trackingLabel, { vehicleId, slug: content });
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            event.preventDefault();
            void queueWhatsAppIfOffline({
              url: event.currentTarget.href,
              label: trackingLabel,
              vehicleId,
            });
          }
        }}
        aria-label={`Tenho interesse em ${label} pelo WhatsApp`}
        className={
          compact
            ? `relative z-[1] pointer-events-auto mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-[#25D366]/20 px-3 text-[12px] font-bold text-[#25D366] ring-1 ring-inset ring-[#25D366]/40 shadow-sm shadow-[#25D366]/10 transition hover:bg-[#25D366]/30 hover:ring-[#25D366]/60 before:absolute before:-inset-x-1 before:-inset-y-1.5 before:content-[''] touch-manipulation ${className}`
            : chat
            ? `relative z-[1] inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#25D366]/15 px-4 text-[13px] font-semibold text-[#25D366] ring-1 ring-inset ring-[#25D366]/30 transition touch-manipulation hover:bg-[#25D366]/25 hover:text-cream ${className}`
            : `inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 border-t border-white/10 bg-[#101612] px-2 font-display text-[11px] font-semibold uppercase tracking-wide text-cream transition touch-manipulation hover:bg-[#14301c] ${className}`
        }
      >
        <IconWhatsApp
          className={chat && !compact ? "h-[18px] w-[18px] text-[#25D366]" : "h-3.5 w-3.5 text-[#25D366]"}
        />
        {chat && !compact ? "WhatsApp" : "Tenho interesse"}
      </a>
    </VehicleLeadHit>
  );
}
