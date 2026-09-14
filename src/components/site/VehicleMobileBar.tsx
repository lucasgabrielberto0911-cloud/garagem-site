"use client";

import Link from "next/link";
import { VehicleLeadHit } from "@/components/site/VehiclePixel";
import { formatCurrencyBRL } from "@/lib/format";
import { trackWhatsAppClick } from "@/lib/meta-pixel";
import { queueWhatsAppIfOffline } from "@/lib/offline-whatsapp";
import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";

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

/** Barra fixa no mobile: atalhos + preço + interesse no WhatsApp. */
export function VehicleMobileBar({
  vehicleId,
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
}: {
  vehicleId: string;
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
}) {
  const isMoto = category === "moto";
  const href = whatsappUrl(
    message ?? WHATSAPP_MESSAGES.vehicle(contentName, isMoto),
  );
  const financeHref = financeMessage ? whatsappUrl(financeMessage) : null;
  const tradeHref = tradeMessage ? whatsappUrl(tradeMessage) : null;
  const videoHref = videoMessage ? whatsappUrl(videoMessage) : null;

  return (
    <div
      data-vehicle-mobile-bar=""
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-asphalt/95 px-3 pt-2 backdrop-blur pb-safe pl-safe pr-safe lg:hidden"
    >
      <div className="mx-auto max-w-6xl">
        {!sold && financeHref && tradeHref && videoHref ? (
          <div className="mb-2 grid grid-cols-3 gap-1.5">
            <a
              href={financeHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) =>
                openWhatsApp(event, financeHref, "ficha-finance", vehicleId)
              }
              className="inline-flex min-h-10 items-center justify-center border border-white/15 px-1 text-center font-display text-[10px] font-semibold uppercase tracking-wide text-cream touch-manipulation"
            >
              Simular parcela
            </a>
            <a
              href={tradeHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) =>
                openWhatsApp(event, tradeHref, "ficha-trade", vehicleId)
              }
              className="inline-flex min-h-10 items-center justify-center border border-white/15 px-1 text-center font-display text-[10px] font-semibold uppercase tracking-wide text-cream touch-manipulation"
            >
              Troca
            </a>
            <a
              href={videoHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) =>
                openWhatsApp(event, videoHref, "ficha-video", vehicleId)
              }
              className="inline-flex min-h-10 items-center justify-center border border-white/15 px-1 text-center font-display text-[10px] font-semibold uppercase tracking-wide text-cream touch-manipulation"
            >
              Pedir vídeo
            </a>
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
          </div>

          {sold ? (
            <Link
              href="/estoque"
              className="inline-flex min-h-[48px] shrink-0 items-center justify-center bg-brand px-5 py-3 font-display text-sm font-semibold text-asphalt touch-manipulation"
            >
              Ver estoque
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
                className="whatsapp-btn inline-flex min-h-[48px] shrink-0 items-center justify-center px-4 py-3 font-display text-sm font-semibold text-white touch-manipulation"
              >
                Tenho interesse
              </a>
            </VehicleLeadHit>
          )}
        </div>
      </div>
    </div>
  );
}
