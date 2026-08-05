"use client";

import { formatCurrencyBRL } from "@/lib/format";
import { whatsappUrl } from "@/lib/site";

/** Barra fixa no mobile: preço + um único CTA de WhatsApp. */
export function VehicleMobileBar({
  brand,
  model,
  year,
  price,
}: {
  brand: string;
  model: string;
  year: number;
  price: number;
}) {
  const label = `${brand} ${model} ${year}`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-asphalt/95 px-3 pt-2.5 backdrop-blur pb-safe lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate text-[10px] text-muted">
            {brand} {model} · {year}
          </p>
          <p className="font-display text-lg font-bold leading-tight text-cream">
            {formatCurrencyBRL(price)}
          </p>
        </div>

        <a
          href={whatsappUrl(
            `Olá! Vi o ${label} no site da Garagem e tenho interesse!`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="whatsapp-btn inline-flex min-h-[44px] shrink-0 items-center justify-center px-5 py-3 font-display text-sm font-semibold text-white touch-manipulation"
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}
