"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  INSTA_DELIVERIES_PAGE_SIZE,
  INSTA_DELIVERIES_SIZES,
  INSTA_DELIVERY_FADE_FALLBACK_MS,
  buildInstaSrcSet,
  formatInstaAlt,
  formatInstaLabels,
  isValidInstaLqip,
  nextInstaDeliveriesCount,
  sliceInstaDeliveries,
  type InstaDeliveryItem,
} from "@/lib/vendidos-insta";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function DeliveryPhoto({
  item,
  isFirst,
  isEager,
}: {
  item: InstaDeliveryItem;
  isFirst: boolean;
  isEager: boolean;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const srcSet = buildInstaSrcSet(item);
  const safeLqip = isValidInstaLqip(item.lqip) ? item.lqip : null;

  useIsomorphicLayoutEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    // Fotos já em cache ou concluídas antes da hidratação permanecem visíveis.
    if (img.complete) {
      img.dataset.photoState = "ready";
      return;
    }
    img.dataset.photoState = "loading";

    const reveal = () => {
      img.dataset.photoState = "ready";
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const armFallbackTimer = () => {
      if (img.complete) {
        reveal();
        return;
      }
      if (timer !== undefined) return;
      timer = setTimeout(reveal, INSTA_DELIVERY_FADE_FALLBACK_MS);
    };

    let observer: IntersectionObserver | undefined;
    if (isEager || typeof IntersectionObserver === "undefined") {
      armFallbackTimer();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            observer = undefined;
            armFallbackTimer();
          }
        },
        { rootMargin: "300px" },
      );
      observer.observe(img);
    }

    const onPageShow = () => {
      if (img.complete) reveal();
      else armFallbackTimer();
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [isEager, item.src, srcSet]);

  return (
    <div
      data-delivery-photo-box=""
      className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-ink bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-white/[0.02] shadow-[0_10px_28px_-14px_rgba(0,0,0,0.65)] transition-shadow duration-300 motion-reduce:transition-none lg:group-hover:shadow-[0_18px_40px_-10px_rgba(217,21,25,0.5)]"
    >
      {safeLqip ? (
        <span
          aria-hidden="true"
          data-delivery-lqip=""
          className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center blur-[12px]"
          style={{ backgroundImage: `url("${safeLqip}")` }}
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- webp estático 360w/600w local com LQIP inline */}
      <img
        ref={imgRef}
        src={item.src}
        srcSet={srcSet}
        sizes={INSTA_DELIVERIES_SIZES}
        alt={formatInstaAlt(item)}
        width={600}
        height={750}
        loading={isEager ? "eager" : "lazy"}
        fetchPriority={isFirst ? "high" : undefined}
        decoding="async"
        draggable={false}
        onLoad={(event) => {
          event.currentTarget.dataset.photoState = "ready";
        }}
        onError={(event) => {
          event.currentTarget.dataset.photoState = "ready";
        }}
        className="relative z-[1] h-full w-full object-cover transition-[opacity,transform] duration-300 ease-out data-[photo-state=loading]:opacity-0 motion-reduce:transition-none lg:motion-safe:group-hover:scale-[1.03]"
      />
      <span
        aria-hidden="true"
        data-sold-badge=""
        className="pointer-events-none absolute left-2 top-2 z-[2] inline-block -rotate-2 rounded-sm bg-brand px-2 py-0.5 font-display text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-white shadow-[0_6px_16px_rgba(0,0,0,0.48)] sm:left-3 sm:top-3 sm:px-3 sm:py-1.5 sm:text-xs"
      >
        VENDIDO
      </span>
    </div>
  );
}

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
          const isEager = !isNewBatch && index < 4;

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
              <DeliveryPhoto
                item={item}
                isFirst={index === 0}
                isEager={isEager}
              />

              <div className="mt-2.5 px-0.5 sm:mt-3">
                {labels.eyebrow ? (
                  <p
                    data-delivery-brand=""
                    className="truncate font-body text-[11px] font-medium uppercase leading-tight tracking-[0.12em] text-muted sm:text-xs"
                  >
                    {labels.eyebrow}
                  </p>
                ) : null}
                <p
                  data-delivery-title=""
                  className={`truncate font-display text-[15px] font-bold leading-snug tracking-tight text-cream transition-colors duration-200 motion-reduce:transition-none sm:text-lg lg:group-hover:text-white ${
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
