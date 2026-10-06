"use client";

import { supabaseOriginalSrc } from "@/lib/stock-query";

/**
 * Capa remota sem o wrapper do next/image.
 * Se o recorte do Storage falhar, troca para o arquivo original.
 */
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
}) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "low"}
      draggable={false}
      className={`absolute inset-0 h-full w-full ${className ?? ""}`}
      onError={(event) => {
        const image = event.currentTarget;
        if (image.dataset.fallbackUsed === "1") return;
        const fallback = supabaseOriginalSrc(image.currentSrc || image.src);
        if (!fallback || fallback === image.src) return;
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
