"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseOriginalSrc } from "@/lib/stock-query";

/** O retry pertence à galeria, fora de links de cards e de botões de miniatura. */
export function RecoverableVehicleImage({ src, alt, width, height, sizes, srcSet, mobileSrcSet, className, priority }: {
  src: string; alt: string; width: number; height: number; sizes?: string;
  srcSet?: string; mobileSrcSet?: string; className?: string; priority?: boolean;
}) {
  const [state, setState] = useState({ original: null as string | null, failed: false, attempt: 0, retrying: false });
  const imageRef = useRef<HTMLImageElement>(null);
  const failedImage = useCallback((image: HTMLImageElement) => {
    if (!state.original) {
      const original = supabaseOriginalSrc(image.currentSrc || src);
      if (original && original !== (image.currentSrc || image.src)) {
        setState(current => ({ ...current, original }));
        return;
      }
    }
    setState(current => ({ ...current, failed: true, retrying: false }));
  }, [src, state.original]);
  // Uma falha do HTML inicial pode acontecer antes da hidratação do React.
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) failedImage(image);
  }, [failedImage, state.attempt]);
  useEffect(() => {
    if (!state.retrying) return;
    const timeout = window.setTimeout(() => setState(current => ({ ...current, failed: true, retrying: false })), 12_000);
    return () => window.clearTimeout(timeout);
  }, [state.retrying, state.attempt]);

  const image = state.failed ? null : (
    // eslint-disable-next-line @next/next/no-img-element -- mantém as variantes públicas existentes
    <img ref={imageRef} key={state.attempt} src={state.original ?? src} srcSet={state.original ? undefined : srcSet}
      sizes={!state.original && srcSet ? sizes : undefined} alt={alt} width={width} height={height}
      loading={priority || state.attempt > 0 ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "low"}
      draggable={false} className={`absolute inset-0 h-full w-full ${className ?? ""}`}
      onLoad={() => setState(current => current.retrying ? { ...current, retrying: false } : current)}
      onError={event => failedImage(event.currentTarget)} />
  );
  return <>
    {mobileSrcSet && !state.original ? (
      <picture className="contents"><source media="(max-width: 639px)" srcSet={mobileSrcSet} sizes={sizes} />{image}</picture>
    ) : image}
    {state.failed || state.retrying ? (
      <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-asphalt px-14 text-center"
        data-photo-recovery="" onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}>
        <div className="pointer-events-auto max-w-sm">
          <p role="status" className="text-xs leading-relaxed text-muted sm:text-sm">
            {state.retrying ? "Carregando foto…" : "Não foi possível carregar esta foto."}
          </p>
          {state.failed ? <button type="button" aria-label="Tentar carregar a foto novamente"
            onClick={event => { event.stopPropagation(); setState(current => ({ original: null, failed: false, attempt: current.attempt + 1, retrying: true })); }}
            className="mt-3 min-h-11 border border-white/25 px-3 text-xs font-semibold text-cream transition hover:border-brand touch-manipulation sm:px-4 sm:text-sm">
            Tentar novamente
          </button> : null}
        </div>
      </div>
    ) : null}
  </>;
}
