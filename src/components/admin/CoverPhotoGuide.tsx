"use client";

import { useEffect, useState } from "react";
import { VehicleImage } from "@/components/VehicleImage";
import { assessCoverPhoto, type CoverAssessment } from "@/lib/cover-photo-quality";
import { isFramedCardUrl } from "@/lib/cover-frame";
import { supabaseCardSrc } from "@/lib/stock-query";
import { btn } from "./ui";
import type { PhotoItem } from "./VehiclePhotoManager";

export function CoverPhotoGuide({ photos, disabled, onCover, onFrame }: { photos: PhotoItem[]; disabled: boolean; onCover: (index: number) => void; onFrame: () => void }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ url: string; assessment: CoverAssessment | null } | null>(null);
  const cover = photos[0];
  const url = cover?.url;
  useEffect(() => {
    if (!open || !url) return;
    let active = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    const finish = (assessment: CoverAssessment | null) => { if (active) setResult({ url, assessment }); };
    const timeout = window.setTimeout(() => finish(null), 10000);
    image.onload = () => {
      window.clearTimeout(timeout);
      try {
        const ratio = Math.min(1, 144 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return finish(null);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        finish(assessCoverPhoto(image.naturalWidth, image.naturalHeight, context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height));
      } catch { finish(null); }
    };
    image.onerror = () => { window.clearTimeout(timeout); finish(null); };
    image.src = url;
    return () => { active = false; window.clearTimeout(timeout); image.onload = null; image.onerror = null; image.src = ""; };
  }, [open, url]);
  if (!cover) return null;
  const current = result?.url === url ? result : null;
  // O mesmo arquivo que o card do site usa; sem miniatura, o recorte ao vivo centralizado.
  const cardSrc = cover.thumbnailUrl || supabaseCardSrc(cover.url) || cover.url;
  const framed = isFramedCardUrl(cover.thumbnailUrl);
  return (
    <>
    <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[.02] p-3">
      <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded bg-asphalt">
        <VehicleImage key={cardSrc} src={cardSrc} alt="Capa como aparece no card do site" fill sizes="112px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-cream">Capa no card</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{framed ? "Enquadramento escolhido por você." : "Enquadramento automático, centralizado."}</p>
        <button type="button" disabled={disabled} onClick={onFrame} className={`${btn.outline} mt-2 w-full sm:w-auto`}>Ajustar enquadramento</button>
      </div>
    </div>
    <details className="mt-3 rounded-lg border border-white/10 bg-white/[.02]" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium text-cream">Conferir a capa do anúncio</summary>
      {open ? <div className="border-t border-white/10 p-3">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
          <div>
            <div className="relative mx-auto aspect-[4/3] w-full max-w-[220px] overflow-hidden rounded-lg bg-asphalt">
              <VehicleImage key={cardSrc} src={cardSrc} alt="Prévia do recorte da capa no anúncio" fill sizes="220px" className="object-cover" />
            </div>
            <p className="mt-2 text-center text-xs text-muted">Recorte da capa no card</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-muted">Confira se o veículo aparece inteiro e está nítido. Estes sinais ajudam você a escolher; não impedem o envio nem a publicação.</p>
            <div className="mt-3 text-xs leading-relaxed" role="status" aria-live="polite">
              {!current ? <p className="text-muted">Conferindo a foto…</p> : !current.assessment ? <p className="text-muted">Não conseguimos analisar essa foto. Você pode conferir a prévia e continuar normalmente.</p> : <>
                <p className="text-muted">{current.assessment.width} × {current.assessment.height} pixels na foto guardada.</p>
                {current.assessment.warnings.length ? <ul className="mt-2 space-y-2 text-cream">{current.assessment.warnings.map(warning => <li key={warning} className="border-l-2 border-brand-orange/60 pl-2">{warning}</li>)}</ul> : <p className="mt-2 text-muted">Sem sinais de atenção nesta leitura. A conferência visual continua sendo sua.</p>}
              </>}
            </div>
            {photos.length > 1 ? <label className="mt-4 block text-xs text-muted">Escolher outra foto como capa
              <select value={cover.id} disabled={disabled} onChange={event => onCover(photos.findIndex(photo => photo.id === event.target.value))} className="mt-2 min-h-11 w-full rounded border border-white/20 bg-ink px-3 text-sm text-cream disabled:opacity-50">
                {photos.map((photo, index) => <option key={photo.id} value={photo.id}>Foto {index + 1}{index === 0 ? " · capa atual" : ""}</option>)}
              </select>
            </label> : null}
            <p className="mt-3 text-xs text-muted">Depois de trocar a capa, salve o anúncio para publicar.</p>
          </div>
        </div>
      </div> : null}
    </details>
    </>
  );
}
