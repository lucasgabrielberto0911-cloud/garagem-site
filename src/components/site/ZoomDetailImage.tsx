"use client";

import { useEffect, useState } from "react";
import { isVehicleCuid } from "@/lib/vehicle-slug";

/** Carrega a cópia maior só após o gesto/botão de zoom; a foto base fica visível. */
export function ZoomDetailImage({ photoId, zoomed, alt }: { photoId: string; zoomed: boolean; alt: string }) {
  const [loaded, setLoaded] = useState<{ id: string; src: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!zoomed || !isVehicleCuid(photoId) || loaded?.id === photoId) return;
    let active = true;
    const image = new Image();
    const baseSrc = "/api/fotos/" + encodeURIComponent(photoId) + "/zoom";
    const src = attempt > 0 ? `${baseSrc}?retry=${attempt}` : baseSrc;
    setLoading(true);
    setFailedId(null);
    const timeout = window.setTimeout(() => {
      if (active) {
        image.src = "";
        setLoading(false);
        setFailedId(photoId);
      }
    }, 12000);
    image.onload = () => {
      window.clearTimeout(timeout);
      if (active) {
        setLoaded({ id: photoId, src: baseSrc });
        setLoading(false);
        setFailedId(null);
      }
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      if (active) {
        setLoading(false);
        setFailedId(photoId);
      }
    };
    image.src = src;
    return () => { active = false; window.clearTimeout(timeout); image.onload = null; image.onerror = null; image.src = ""; };
  }, [photoId, zoomed, loaded?.id, attempt]);
  const current = loaded?.id === photoId ? loaded : null;
  const failed = failedId === photoId && !current && !loading;
  return <>
    {current ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={current.src} alt={alt} width={3840} height={2880} aria-hidden="true" draggable={false} onError={event => { event.currentTarget.style.visibility = "hidden"; setFailedId(photoId); }} className="pointer-events-none absolute inset-0 h-full w-full object-contain [-webkit-touch-callout:none]" />
    ) : null}
    {zoomed && loading && !current ? <span role="status" className="sr-only">Carregando mais detalhe na foto.</span> : null}
    {zoomed && failed ? (
      <div
        role="status"
        data-zoom-detail-error=""
        className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/20 bg-asphalt/95 px-3 py-2 text-xs text-cream shadow-lg"
      >
        <span>Detalhe em alta definição indisponível.</span>
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            setFailedId(null);
            setAttempt(value => value + 1);
          }}
          className="min-h-9 rounded border border-white/25 px-2.5 py-1 font-semibold text-brand-light transition hover:border-brand hover:text-cream"
        >
          Tentar novamente
        </button>
      </div>
    ) : null}
  </>;
}
