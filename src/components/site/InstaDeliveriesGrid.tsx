"use client";

import { useState } from "react";
import {
  INSTA_DELIVERIES_PAGE_SIZE,
  formatInstaAlt,
  formatInstaAriaLabel,
  formatInstaCaption,
  formatInstaMonthYear,
  formatInstaVehicleLabel,
  nextInstaDeliveriesCount,
  sliceInstaDeliveries,
  type InstaDeliveryItem,
} from "@/lib/vendidos-insta";

export function InstaDeliveriesGrid({
  items,
  pageSize = INSTA_DELIVERIES_PAGE_SIZE,
}: {
  items: readonly InstaDeliveryItem[];
  pageSize?: number;
}) {
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(pageSize, items.length),
  );

  const visibleItems = sliceInstaDeliveries(items, visibleCount);
  const hasMore = visibleItems.length < items.length;

  return (
    <div>
      <ul
        data-insta-deliveries-grid=""
        className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        {visibleItems.map((item) => {
          const vehicleLabel = formatInstaVehicleLabel(item);
          const caption = formatInstaCaption(item);
          const monthYear = formatInstaMonthYear(item.date);

          return (
            <li key={item.id} className="min-w-0">
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={formatInstaAriaLabel(item)}
                className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element -- webp estático 640x480 local já otimizado */}
                  <img
                    src={item.src}
                    alt={formatInstaAlt(item)}
                    width={640}
                    height={480}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="mt-2">
                  <p className="truncate font-display text-xs font-semibold text-cream transition group-hover:text-brand-light sm:text-sm">
                    {caption}
                  </p>
                  {vehicleLabel ? (
                    <p className="mt-0.5 text-xs text-muted">{monthYear}</p>
                  ) : null}
                </div>
              </a>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-col items-center gap-3">
        <p className="text-xs text-muted sm:text-sm" data-insta-deliveries-counter="">
          Mostrando {visibleItems.length} de {items.length}
        </p>

        {hasMore ? (
          <button
            type="button"
            onClick={() =>
              setVisibleCount((current) =>
                nextInstaDeliveriesCount(current, items.length, pageSize),
              )
            }
            className="inline-flex min-h-[52px] w-full items-center justify-center border border-brand/60 bg-brand/10 px-7 py-3.5 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:border-brand hover:bg-brand hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt touch-manipulation sm:w-auto sm:text-base"
          >
            Ver mais entregas
          </button>
        ) : null}
      </div>
    </div>
  );
}
