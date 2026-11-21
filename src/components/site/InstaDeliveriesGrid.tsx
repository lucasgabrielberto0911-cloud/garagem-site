"use client";

import { useState } from "react";
import {
  INSTA_DELIVERIES_PAGE_SIZE,
  formatInstaAlt,
  formatInstaLabels,
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
  const [animatedFrom, setAnimatedFrom] = useState(items.length);

  const visibleItems = sliceInstaDeliveries(items, visibleCount);
  const hasMore = visibleItems.length < items.length;

  return (
    <div>
      <ul
        data-insta-deliveries-grid=""
        className="grid grid-cols-2 gap-x-3.5 gap-y-6 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-9"
      >
        {visibleItems.map((item, index) => {
          const labels = formatInstaLabels(item);
          const isNewBatch = index >= animatedFrom;

          return (
            <li
              key={item.id}
              data-insta-delivery-item=""
              className={`group min-w-0${isNewBatch ? " animate-fade-in-scale" : ""}`}
              style={
                isNewBatch
                  ? {
                      animationDelay: `${Math.min((index - animatedFrom) * 20, 240)}ms`,
                    }
                  : undefined
              }
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-white/[0.06] transition-shadow duration-300 motion-reduce:transition-none lg:group-hover:shadow-[0_16px_36px_-12px_rgba(217,21,25,0.45)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- webp estático 600x750 local já otimizado */}
                <img
                  src={item.src}
                  alt={formatInstaAlt(item)}
                  width={600}
                  height={750}
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  loading={index < 4 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : undefined}
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 ease-out motion-reduce:transition-none lg:motion-safe:group-hover:scale-[1.03]"
                />
                <span
                  data-sold-badge=""
                  className="pointer-events-none absolute left-2.5 top-2.5 inline-block -rotate-2 rounded-sm bg-brand px-2.5 py-1 font-display text-[11px] font-bold uppercase leading-none tracking-[0.12em] text-white shadow-[0_6px_16px_rgba(0,0,0,0.45)] sm:left-3 sm:top-3 sm:px-3 sm:py-1.5 sm:text-xs"
                >
                  VENDIDO
                </span>
              </div>

              <div className="mt-2.5 px-0.5 sm:mt-3">
                {labels.eyebrow ? (
                  <p
                    data-delivery-brand=""
                    className="truncate font-body text-[11px] font-medium uppercase tracking-[0.12em] text-muted sm:text-xs"
                  >
                    {labels.eyebrow}
                  </p>
                ) : null}
                <p
                  data-delivery-title=""
                  className={`truncate font-display text-base font-bold leading-snug text-cream sm:text-lg ${
                    labels.eyebrow ? "mt-0.5" : ""
                  }`}
                >
                  {labels.title}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {hasMore ? (
        <div className="mt-10 flex justify-center sm:mt-12">
          <button
            type="button"
            onClick={() => {
              setAnimatedFrom(visibleCount);
              setVisibleCount((current) =>
                nextInstaDeliveriesCount(current, items.length, pageSize),
              );
            }}
            className="inline-flex min-h-[56px] w-full items-center justify-center rounded-md bg-brand px-10 py-4 font-display text-base font-bold uppercase tracking-wide text-white shadow-[0_12px_28px_-8px_rgba(217,21,25,0.5)] transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt active:bg-brand-dark touch-manipulation motion-reduce:transition-none sm:w-auto sm:min-w-[240px]"
          >
            Ver mais
          </button>
        </div>
      ) : null}
    </div>
  );
}
