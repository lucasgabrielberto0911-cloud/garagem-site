"use client";

import { useLayoutEffect, useRef } from "react";
import { publicVehiclePhotoSrc } from "@/lib/public-photo-url";

import { supabaseOriginalSrc } from "@/lib/stock-query";
import { RecoverableVehicleImage } from "@/components/RecoverableVehicleImage";

/**
 * Capa remota sem o wrapper do next/image.
 * Se o recorte do Storage falhar, troca para a cópia pública limitada a 1280 px.
 * Com `fadeIn`, o HTML SSR mantém a foto visível (sem depender de JS); após a
 * hidratação, só imagens ainda pendentes aguardam `load` para aparecer com fade.
 */
export const PHOTO_FADE_FALLBACK_MS = 2500;

export function NativeRemoteFillImage({
  src,
  alt,
  width,
  height,
  sizes,
  srcSet,
  mobileSrcSet,
  className,
  priority,
  eager = false,
  fadeIn = false,
  decoding,
  recoverable = false,
  onReady,
  onErrorState,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  srcSet?: string;
  mobileSrcSet?: string;
  className?: string;
  priority?: boolean;
  eager?: boolean;
  fadeIn?: boolean;
  decoding?: "sync" | "async" | "auto";
  recoverable?: boolean;
  onReady?: () => void;
  onErrorState?: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    if (!fadeIn || recoverable) return;
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
      timer = setTimeout(reveal, PHOTO_FADE_FALLBACK_MS);
    };

    let observer: IntersectionObserver | undefined;
    if (priority || eager || typeof IntersectionObserver === "undefined") {
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
  }, [fadeIn, recoverable, priority, eager, src, srcSet, mobileSrcSet]);

  if (recoverable) return <RecoverableVehicleImage key={src} src={src} alt={alt} width={width} height={height} sizes={sizes} srcSet={srcSet} mobileSrcSet={mobileSrcSet} className={className} priority={priority} eager={eager} decoding={decoding} onReady={onReady} onErrorState={onErrorState} />;

  const fadeClass = fadeIn ? " vehicle-photo-fade" : "";
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={priority || eager ? "eager" : "lazy"}
      decoding={decoding ?? (priority ? "sync" : "async")}
      fetchPriority={priority ? "high" : eager ? "auto" : "low"}
      draggable={false}
      className={`absolute inset-0 h-full w-full${fadeClass} ${className ?? ""}`}
      onLoad={(event) => {
        if (fadeIn) event.currentTarget.dataset.photoState = "ready";
        onReady?.();
      }}
      onError={(event) => {
        const image = event.currentTarget;
        if (image.dataset.fallbackUsed === "1") {
          if (fadeIn) image.dataset.photoState = "ready";
          onErrorState?.();
          return;
        }
        const fallback = publicVehiclePhotoSrc(supabaseOriginalSrc(image.currentSrc || image.src));
        if (!fallback || fallback === image.src) {
          if (fadeIn) image.dataset.photoState = "ready";
          onErrorState?.();
          return;
        }
        image.dataset.fallbackUsed = "1";
        // Sem isto o <picture> insistiria no recorte que acabou de falhar.
        image.closest("picture")?.querySelectorAll("source").forEach((source) => source.removeAttribute("srcset"));
        image.srcset = "";
        image.src = fallback;
      }}
    />
  );
  return mobileSrcSet ? (
    <picture className="contents">
      <source media="(max-width: 639px)" srcSet={mobileSrcSet} sizes={sizes} />
      {image}
    </picture>
  ) : image;
}
