"use client";

import Link from "next/link";
import { VehicleLeadHit } from "@/lib/funnel-events";
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
 * Barra fixa no mobile: preço à esquerda e botão de WhatsApp à direita,
 * flutuando com margem (respeita a safe-area do iPhone). Vendido não mostra
 * preço. A altura reservada está em `--ficha-sticky-bar` para o fim da página
 * não ficar por baixo. Financiamento, troca, vídeo e visita seguem na ficha.
 */
export function VehicleMobileBar({
  vehicleId,
  vehicleSlug,
  vehiclePath,
  contentName,
  message,
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
  const track = fichaWhatsAppTracking({ id: vehicleId, path: vehiclePath });
  const href = whatsappUrl(
    message ?? WHATSAPP_MESSAGES.vehicle(contentName, isMoto),
    track,
  );

  return (
    <div
      data-vehicle-mobile-bar=""
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 box-border bg-gradient-to-t from-asphalt/90 via-asphalt/60 to-transparent pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] lg:hidden"
    >
      <div className="mx-auto max-w-6xl">
        {sold ? (
          <Link
            href={soldHref}
            prefetch={false}
            className="pointer-events-auto flex h-14 w-full items-center justify-center rounded-xl bg-brand px-5 font-display text-base font-semibold text-cream shadow-lg touch-manipulation"
          >
            {soldLabel}
          </Link>
        ) : (
          <div className="flex items-center gap-2">
          <p
            data-mobile-bar-price=""
            className="pointer-events-auto flex h-14 shrink-0 items-center whitespace-nowrap rounded-xl border border-white/10 bg-asphalt/95 px-3 font-display text-lg font-bold tracking-tight text-brand-light"
          >
            {formatCurrencyBRL(price)}
          </p>
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
              aria-label={`Chamar no WhatsApp — ${contentName}`}
              onClick={(event) =>
                openWhatsApp(event, href, "ficha-mobile", vehicleId, vehicleSlug)
              }
              className="ficha-whatsapp-cta pointer-events-auto flex h-14 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#25D366] px-3 font-display text-[15px] font-bold text-asphalt shadow-[0_6px_18px_rgba(0,0,0,0.4)] touch-manipulation transition active:scale-[0.98] active:bg-[#1FB858] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
            >
              <IconWhatsApp className="h-5 w-5 shrink-0" />
              <span>
                <span className="max-[399px]:hidden">Chamar no </span>WhatsApp
              </span>
            </a>
          </VehicleLeadHit>
          </div>
        )}
      </div>
    </div>
  );
}
