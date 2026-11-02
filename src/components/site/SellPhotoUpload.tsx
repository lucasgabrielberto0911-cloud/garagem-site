"use client";

import { useEffect, useRef, useState } from "react";
import { prepareImageForUpload } from "@/lib/prepare-image-upload";
import {
  limitSellPhotoSelection,
  MAX_SELL_PHOTO_BYTES,
  MAX_SELL_PHOTOS,
  prepareSellPhoto,
  uploadSellPhoto,
} from "@/lib/sell-photo-upload";

type Phase = "waiting" | "preparing" | "uploading" | "saving" | "done" | "failed";
type Job = {
  id: string;
  file: File;
  previewUrl?: string;
  phase: Phase;
  percent: number;
  url?: string;
  error?: string;
};
const buttonClass = "min-h-11 rounded-lg border border-white/20 px-3 text-xs font-semibold text-cream transition hover:border-brand disabled:opacity-50";

function createPreviewUrl(file: File): string | undefined {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return undefined;
  try {
    return URL.createObjectURL(file);
  } catch {
    return undefined;
  }
}

function revokePreviewUrl(url?: string) {
  if (!url || typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignora falha ao liberar URL de objeto local.
  }
}

export function SellPhotoUpload({ disabled, onBusyChange, onUrlsChange }: { disabled: boolean; onBusyChange: (busy: boolean) => void; onUrlsChange: (urls: string[]) => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [limitNotice, setLimitNotice] = useState("");
  const jobsRef = useRef<Job[]>([]);
  const running = useRef(false);
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      for (const job of jobsRef.current) {
        revokePreviewUrl(job.previewUrl);
      }
    };
  }, []);
  function replace(next: Job[]) {
    if (!mounted.current) return;
    const nextIds = new Set(next.map(item => item.id));
    for (const prev of jobsRef.current) {
      if (!nextIds.has(prev.id)) revokePreviewUrl(prev.previewUrl);
    }
    jobsRef.current = next; setJobs(next); onUrlsChange(next.flatMap(job => job.url ? [job.url] : []));
  }
  function patch(id: string, fields: Partial<Job>) { replace(jobsRef.current.map(job => job.id === id ? { ...job, ...fields } : job)); }
  async function run(ids: string[]) {
    if (running.current || disabled) return;
    running.current = true; setBusy(true); onBusyChange(true);
    try {
      for (const id of ids) {
        const job = jobsRef.current.find(item => item.id === id);
        if (!job || job.url || !mounted.current) continue;
        const active = new AbortController(); controller.current = active;
        patch(id, { phase: "preparing", percent: 0, error: undefined });
        try {
          const prepared = await prepareSellPhoto(job.file, active.signal, prepareImageForUpload);
          patch(id, { phase: "uploading" });
          const url = await uploadSellPhoto(prepared, active.signal, percent => patch(id, { percent, phase: percent === 100 ? "saving" : "uploading" }));
          patch(id, { phase: "done", percent: 100, url });
        } catch (error) {
          const cancelled = error instanceof Error && error.name === "AbortError";
          patch(id, { phase: "failed", error: cancelled ? "Envio cancelado. Você pode tentar novamente." : error instanceof Error ? error.message : "Não foi possível enviar esta foto." });
          if (cancelled) {
            replace(jobsRef.current.map(item => item.phase === "waiting" ? { ...item, phase: "failed", error: "Envio cancelado. Você pode tentar novamente." } : item));
            break;
          }
        }
      }
    } finally {
      controller.current = null; running.current = false;
      if (mounted.current) { setBusy(false); onBusyChange(false); }
    }
  }
  function select(files: File[]) {
    if (running.current || disabled || files.length === 0) return;
    const validSizeFiles = files.filter(file => file.size <= MAX_SELL_PHOTO_BYTES);
    const oversizedCount = files.length - validSizeFiles.length;
    const { accepted, ignoredCount } = limitSellPhotoSelection(
      jobsRef.current.length,
      validSizeFiles,
      MAX_SELL_PHOTOS,
    );
    const notices: string[] = [];
    if (oversizedCount > 0) {
      notices.push(`Ignoramos ${oversizedCount} arquivo(s) acima de 15 MB.`);
    }
    if (ignoredCount > 0) {
      notices.push(`Você pode adicionar até ${MAX_SELL_PHOTOS} fotos por avaliação.`);
    }
    setLimitNotice(notices.join(" "));
    if (accepted.length === 0) return;
    const added: Job[] = accepted.map(file => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: createPreviewUrl(file),
      phase: "waiting",
      percent: 0,
    }));
    replace([...jobsRef.current, ...added]); void run(added.map(job => job.id));
  }
  const atMaxPhotos = jobs.length >= MAX_SELL_PHOTOS;
  return <div data-sell-photo-upload="">
    <label htmlFor="photos" className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Fotos do seu veículo <span className="normal-case font-normal">(opcional · até {MAX_SELL_PHOTOS} fotos)</span></span>
      <span id="photos-hint" className="mb-3 block text-xs leading-relaxed text-muted">Ajudam na avaliação. Fotos de celular servem e ficam só no pedido, sem ir para o site.</span>
      <span className={`flex min-h-[52px] items-center justify-center rounded-lg border border-dashed border-white/20 px-4 text-center font-display text-xs font-semibold uppercase tracking-wide text-cream ${busy || disabled || atMaxPhotos ? "opacity-60" : "hover:border-brand"}`}>{busy ? "Enviando suas fotos…" : atMaxPhotos ? `Limite de ${MAX_SELL_PHOTOS} fotos atingido` : "Escolher fotos"}</span>
    </label>
    <input id="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple disabled={disabled || busy || atMaxPhotos} aria-describedby="photos-hint" className="sr-only"
      onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; select(files); }} />
    {limitNotice ? <p role="alert" className="mt-2 text-xs leading-relaxed text-brand-light">{limitNotice}</p> : null}
    <ul className="mt-3 space-y-3">
      {jobs.map((job, index) => <li key={job.id} className="rounded-lg border border-white/15 bg-asphalt p-3" data-photo-phase={job.phase}>
        <div className="flex items-start gap-3">
          {job.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={job.previewUrl}
              alt={`Prévia da foto ${index + 1}`}
              width={64}
              height={48}
              className="h-12 w-16 shrink-0 rounded object-cover bg-ink"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-semibold leading-relaxed text-cream">Foto {index + 1} · {job.file.name}</p>
            <p role="status" className="mt-1 text-xs leading-relaxed text-muted">{job.phase === "waiting" ? "Aguardando envio" : job.phase === "preparing" ? "Preparando a foto…" : job.phase === "uploading" ? `Enviando · ${job.percent}%` : job.phase === "saving" ? "Confirmando o envio…" : job.phase === "done" ? "Foto adicionada ao pedido" : job.error}</p>
          </div>
        </div>
        {job.phase === "uploading" || job.phase === "saving" ? <progress max={100} value={job.percent} aria-label={`Progresso do envio da foto ${index + 1}`} className="mt-2 h-2 w-full accent-brand" /> : null}
        {job.phase === "failed" || job.phase === "done" ? <div className="mt-2 flex flex-wrap gap-2">
          {job.phase === "failed" ? <button type="button" disabled={disabled || busy} onClick={() => void run([job.id])} className={buttonClass}>Tentar enviar foto {index + 1}</button> : null}
          <button type="button" disabled={disabled || busy} aria-label={`Remover foto ${index + 1}`} onClick={() => { setLimitNotice(""); replace(jobsRef.current.filter(item => item.id !== job.id)); }} className={buttonClass}>Remover</button>
        </div> : null}
      </li>)}
    </ul>
    {busy ? <button type="button" onClick={() => controller.current?.abort()} className={buttonClass + " mt-3"}>Cancelar envio das fotos</button> : null}
    {jobs.some(job => job.phase === "failed") ? <p className="mt-3 text-xs leading-relaxed text-muted">As fotos já adicionadas continuam no pedido. Tente de novo ou remova a foto que falhou. Só as fotos adicionadas seguem no pedido.</p> : null}
    {jobs.flatMap(job => job.url ? [<input key={job.id} type="hidden" name="photoUrls" value={job.url} />] : [])}
  </div>;
}
