"use client";

import { useEffect, useState } from "react";
import { isVehicleCuid } from "@/lib/vehicle-slug";

/** Carrega a cópia maior só após o gesto/botão de zoom; a foto base fica visível. */
export function ZoomDetailImage({ photoId, zoomed, alt }: { photoId: string; zoomed: boolean; alt: string }) {
  const [loaded, setLoaded] = useState<{ id: string; src: string } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!zoomed || !isVehicleCuid(photoId) || loaded?.id === photoId) return;
    let active = true;
    const image = new Image();
    const src = "/api/fotos/" + encodeURIComponent(photoId) + "/zoom";
    setLoading(true);
    const timeout = window.setTimeout(() => { if (active) { image.src = ""; setLoading(false); } }, 12000);
    image.onload = () => { window.clearTimeout(timeout); if (active) { setLoaded({ id: photoId, src }); setLoading(false); } };
    image.onerror = () => { window.clearTimeout(timeout); if (active) setLoading(false); };
    image.src = src;
    return () => { active = false; window.clearTimeout(timeout); image.onload = null; image.onerror = null; image.src = ""; };
  }, [photoId, zoomed, loaded?.id]);
  const current = loaded?.id === photoId ? loaded : null;
  return <>
    {current ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={current.src} alt={alt} aria-hidden="true" draggable={false} onError={event => { event.currentTarget.style.visibility = "hidden"; }} className="pointer-events-none absolute inset-0 h-full w-full object-contain [-webkit-touch-callout:none]" />
    ) : null}
    {zoomed && loading && !current ? <span role="status" className="sr-only">Carregando mais detalhe na foto.</span> : null}
  </>;
}
