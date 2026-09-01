"use client";

import Link from "next/link";
import { VehicleLeadHit } from "@/components/site/VehiclePixel";
import { formatCurrencyBRL } from "@/lib/format";
import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";

/** Barra fixa no mobile: preço + CTA de interesse no WhatsApp. */
export function VehicleMobileBar({
  vehicleId,
  contentName,
  brand,
  model,
  year,
  price,
  sold = false,
}: {
  vehicleId: string;
  contentName: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  sold?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-asphalt/95 px-3 pt-3 backdrop-blur pb-safe lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
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
              href={whatsappUrl(WHATSAPP_MESSAGES.vehicle(contentName))}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-btn inline-flex min-h-[48px] shrink-0 items-center justify-center px-4 py-3 font-display text-sm font-semibold text-white touch-manipulation"
            >
              Tenho interesse
            </a>
          </VehicleLeadHit>
        )}
      </div>
    </div>
  );
}
