"use client";

import { useState } from "react";
import {
  INSTA_DELIVERIES_PAGE_SIZE,
  formatInstaAlt,
  formatInstaCaption,
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
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        {visibleItems.map((item, index) => (
          <li key={item.id} className="min-w-0">
            <div className="aspect-[4/3] w-full overflow-hidden bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- webp estático 640x480 local já otimizado */}
              <img
                src={item.src}
                alt={formatInstaAlt(item)}
                width={640}
                height={480}
                loading={index < 4 ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-2 truncate font-display text-sm font-semibold text-cream sm:text-base">
              {formatInstaCaption(item)}
            </p>
          </li>
        ))}
      </ul>

      {hasMore ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() =>
              setVisibleCount((current) =>
                nextInstaDeliveriesCount(current, items.length, pageSize),
              )
            }
            className="inline-flex min-h-[52px] w-full items-center justify-center border border-brand/60 bg-brand/10 px-8 py-4 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:border-brand hover:bg-brand hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt touch-manipulation sm:w-auto sm:text-base"
          >
            Ver mais
          </button>
        </div>
      ) : null}
    </div>
  );
}
