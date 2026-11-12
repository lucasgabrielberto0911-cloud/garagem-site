import { IconWhatsApp } from "@/components/site/icons";
import { TrackedWhatsAppLink } from "@/components/site/TrackedWhatsAppLink";
import { VehicleLeadHit } from "@/lib/funnel-events";
import { fichaWhatsAppTracking, whatsappUrl } from "@/lib/site";

function fichaHref(message: string, contentId: string, contentPath?: string) {
  return whatsappUrl(
    message,
    fichaWhatsAppTracking({ id: contentId, path: contentPath }),
  );
}

type Action = {
  trackingLabel: string;
  hrefMessage: string;
  label: string;
  ariaLabel: string;
};

export function VehicleQuickActions({
  contentId,
  contentSlug,
  contentPath,
  contentName,
  value,
  make,
  model,
  year,
  stateOfVehicle,
  exteriorColor,
  transmission,
  bodyStyle,
  fuelType,
  postalCode,
  video,
  finance,
  trade,
  visit,
  className = "hidden lg:grid",
  variant = "default",
}: {
  contentId: string;
  contentSlug?: string;
  contentPath?: string;
  contentName: string;
  value: number;
  make: string;
  model: string;
  year: number;
  stateOfVehicle?: string;
  exteriorColor?: string;
  transmission?: string;
  bodyStyle?: string;
  fuelType?: string;
  postalCode?: string;
  video: string;
  finance: string;
  trade: string;
  visit?: string;
  className?: string;
  /** `secondary`: botões menores, sem competir com o WhatsApp principal. */
  variant?: "default" | "secondary";
}) {
  const actions: Action[] = [
    {
      trackingLabel: "ficha-finance",
      hrefMessage: finance,
      label: "Perguntar sobre financiamento",
      ariaLabel: "Falar sobre financiamento deste veículo no WhatsApp",
    },
    {
      trackingLabel: "ficha-trade",
      hrefMessage: trade,
      label: "Tenho um usado para trocar",
      ariaLabel: "Avaliar uma troca deste veículo no WhatsApp",
    },
    {
      trackingLabel: "ficha-video",
      hrefMessage: video,
      label: "Pedir vídeo",
      ariaLabel: "Pedir vídeo deste veículo no WhatsApp",
    },
    ...(visit
      ? [
          {
            trackingLabel: "ficha-visit",
            hrefMessage: visit,
            label: "Agendar visita",
            ariaLabel: "Agendar visita: combinar dia e hora pelo WhatsApp",
          },
        ]
      : []),
  ];

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {actions.map((action) => (
        <VehicleLeadHit
          key={action.trackingLabel}
          contentId={contentId}
          contentName={contentName}
          value={value}
          make={make}
          model={model}
          year={year}
          stateOfVehicle={stateOfVehicle}
          exteriorColor={exteriorColor}
          transmission={transmission}
          bodyStyle={bodyStyle}
          fuelType={fuelType}
          postalCode={postalCode}
        >
          <TrackedWhatsAppLink
            href={fichaHref(action.hrefMessage, contentId, contentPath)}
            trackingLabel={action.trackingLabel}
            ariaLabel={action.ariaLabel}
            vehicleId={contentId}
            slug={contentSlug}
            className={
              variant === "secondary"
                ? "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.04] px-2.5 py-2 text-center font-display text-sm font-medium text-cream transition touch-manipulation hover:border-[#25D366]/60 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                : "inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-ink px-2.5 py-2 text-center font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-cream transition touch-manipulation hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:min-h-[44px]"
            }
          >
            <IconWhatsApp className="h-3.5 w-3.5 shrink-0 text-[#25D366]" />
            <span>{action.label}</span>
          </TrackedWhatsAppLink>
        </VehicleLeadHit>
      ))}
    </div>
  );
}
