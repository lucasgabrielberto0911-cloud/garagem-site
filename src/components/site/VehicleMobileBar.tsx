"use client";

import { IconPhone } from "@/components/site/icons";
import { formatCurrencyBRL } from "@/lib/format";
import { telUrl, whatsappUrl } from "@/lib/site";

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

  function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator.share({
        title: label,
        text: `Confira esse ${label} na Garagem!`,
        url: window.location.href,
      });
      return;
    }
    void navigator.clipboard?.writeText(window.location.href);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-asphalt/95 px-3 pt-2.5 backdrop-blur pb-safe lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate text-[10px] text-muted">
            {brand} {model} · {year}
          </p>
          <p className="font-display text-lg font-bold leading-tight text-cream">
            {formatCurrencyBRL(price)}
          </p>
        </div>

        <button
          type="button"
          onClick={share}
          aria-label="Compartilhar"
          className="flex h-11 w-11 shrink-0 items-center justify-center border border-white/15 bg-ink text-cream transition active:bg-white/10 touch-manipulation"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-[18px] w-[18px]"
            aria-hidden="true"
          >
            <path
              d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <a
          href={telUrl()}
          aria-label="Ligar"
          className="flex h-11 w-11 shrink-0 items-center justify-center border border-brand/40 bg-brand/10 text-brand transition active:bg-brand/20 touch-manipulation"
        >
          <IconPhone className="h-[18px] w-[18px]" />
        </a>

        <a
          href={whatsappUrl(
            `Olá! Vi o ${label} no site da Garagem e tenho interesse!`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="whatsapp-btn inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 px-4 py-3 font-display text-sm font-semibold text-white touch-manipulation"
        >
          Interesse
        </a>
      </div>
    </div>
  );
}
