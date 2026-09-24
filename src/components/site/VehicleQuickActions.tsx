import { TrackedWhatsAppLink } from "@/components/site/TrackedWhatsAppLink";
import { VehicleLeadHit } from "@/components/site/VehiclePixel";
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
  video,
  finance,
  trade,
  className = "hidden lg:grid",
}: {
  contentId: string;
  contentSlug?: string;
  contentPath?: string;
  contentName: string;
  value: number;
  make: string;
  model: string;
  year: number;
  video: string;
  finance: string;
  trade: string;
  className?: string;
}) {
  const actions: Action[] = [
    { trackingLabel: "ficha-finance", hrefMessage: finance, label: "Simular" },
    { trackingLabel: "ficha-trade", hrefMessage: trade, label: "Troca" },
    { trackingLabel: "ficha-video", hrefMessage: video, label: "Vídeo" },
  ];

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {actions.map((action) => (
        <VehicleLeadHit
          key={action.trackingLabel}
          contentId={contentId}
          contentName={contentName}
          value={value}
          make={make}
          model={model}
          year={year}
        >
          <TrackedWhatsAppLink
            href={fichaHref(action.hrefMessage, contentId, contentPath)}
            trackingLabel={action.trackingLabel}
            vehicleId={contentId}
            slug={contentSlug}
            className="inline-flex min-h-[48px] items-center justify-center border border-white/10 bg-ink px-2 text-center font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-cream transition touch-manipulation hover:border-brand lg:min-h-[44px]"
          >
            {action.label}
          </TrackedWhatsAppLink>
        </VehicleLeadHit>
      ))}
    </div>
  );
}
