"use client";

import { assessCoverPhoto } from "@/lib/cover-photo-quality";
import type { VehicleFormSectionId } from "@/lib/admin-form-sections";
import {
  isListingJudgment,
  presentListing,
  type ListingDraft,
  type ListingJudgment,
} from "@/lib/listing-present";
import { useEffect, useState } from "react";

const DEBOUNCE_MS = 800;

function useCoverWarnings(url: string) {
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!url) {
      setWarnings([]);
      return;
    }
    setWarnings([]);
    let active = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    const finish = (next: string[]) => {
      if (active) setWarnings(next);
    };
    const timeout = window.setTimeout(() => finish([]), 8000);
    image.onload = () => {
      window.clearTimeout(timeout);
      try {
        const ratio = Math.min(
          1,
          144 / Math.max(image.naturalWidth, image.naturalHeight),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          finish([]);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const assessment = assessCoverPhoto(
          image.naturalWidth,
          image.naturalHeight,
          context.getImageData(0, 0, canvas.width, canvas.height).data,
          canvas.width,
          canvas.height,
        );
        finish(assessment.warnings);
      } catch {
        finish([]);
      }
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      finish([]);
    };
    image.src = url;
    return () => {
      active = false;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      image.src = "";
    };
  }, [url]);

  return warnings;
}

function requestBody(draft: ListingDraft) {
  return {
    brand: draft.brand,
    model: draft.model,
    version: draft.version,
    year: draft.year,
    yearModel: draft.yearModel,
    km: draft.km,
    transmission: draft.transmission,
    fuel: draft.fuel,
    color: draft.color,
    price: draft.price,
    description: draft.description,
    accessories: draft.accessories,
    photoCount: draft.photoCount,
    status: draft.status,
    category: draft.category,
  };
}

export function ListingQualityCard({
  draft,
  coverUrl,
  onJump,
}: {
  draft: ListingDraft;
  coverUrl: string;
  onJump: (section: VehicleFormSectionId) => void;
}) {
  const coverWarnings = useCoverWarnings(coverUrl);
  const [judgment, setJudgment] = useState<ListingJudgment | null>(null);
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const serialized = JSON.stringify(requestBody(draft));

  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), 350);
    return () => window.clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    const payload = JSON.parse(serialized) as ListingDraft;
    if (payload.status === "vendido" || !payload.brand.trim() || !payload.model.trim()) {
      setJudgment(null);
      setPending(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPending(true);
      void fetch("/api/admin/anuncios/nota", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: serialized,
      })
        .then(async (response) => {
          if (!response.ok) {
            setJudgment(null);
            return;
          }
          const data = (await response.json()) as { judgment?: unknown };
          setJudgment(isListingJudgment(data.judgment) ? data.judgment : null);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setJudgment(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setPending(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [serialized]);

  if (draft.status === "vendido") return null;

  const view = presentListing({ ...draft, coverWarnings }, judgment);
  if (!view.prompt && view.advice.length === 0 && !view.clearNote && !view.grade) {
    return null;
  }

  const statusLine = view.prompt
    ? view.prompt
    : view.grade
      ? view.grade.label
      : slow
        ? "Lendo a legenda…"
        : null;
  const scoreText = view.grade
    ? view.grade.score.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : null;

  return (
    <section
      aria-label="Força do anúncio"
      className="relative overflow-hidden border border-white/10 bg-ink/50"
    >
      <span
        className="absolute inset-y-0 left-0 w-0.5 bg-brand-gradient"
        aria-hidden="true"
      />
      <div className="px-3 py-3 pl-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold tracking-wide text-cream">
              {view.grade ? "Força do anúncio" : "Antes de publicar"}
            </h2>
            {statusLine ? (
              <p
                className={`mt-0.5 text-xs ${view.grade?.label === "Fraco" ? "text-brand" : "text-muted"}`}
                aria-live="polite"
              >
                {statusLine}
              </p>
            ) : null}
          </div>
          {scoreText ? (
            <p className="shrink-0 text-right">
              <span className="font-display text-3xl font-bold leading-none text-cream">
                {scoreText}
              </span>
              <span className="mt-1 block text-[11px] text-muted">de 10</span>
            </p>
          ) : null}
        </div>

        {view.grade ? (
          <div className="mt-3 h-1 bg-white/10" aria-hidden="true">
            <div
              className="h-full bg-brand"
              style={{ width: `${view.grade.score * 10}%` }}
            />
          </div>
        ) : null}

        {view.clearNote ? (
          <p className="mt-3 text-sm leading-relaxed text-cream">{view.clearNote}</p>
        ) : null}

        {view.advice.length > 0 ? (
          <ul className="mt-3 border-t border-white/10">
            {(showAll ? view.advice : view.advice.slice(0, 4)).map((item) => (
              <li key={item.id} className="border-b border-white/10 last:border-b-0">
                <button
                  type="button"
                  onClick={() => onJump(item.section)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 py-2.5 text-left touch-manipulation"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-cream">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                      {item.detail}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-lg leading-none text-muted" aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {view.advice.length > 4 ? (
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            className="mt-1 min-h-11 w-full text-left text-xs font-semibold text-cream touch-manipulation"
          >
            {showAll
              ? "Mostrar menos"
              : `Mais ${view.advice.length - 4} ${view.advice.length - 4 === 1 ? "ponto" : "pontos"}`}
          </button>
        ) : null}

        {view.grade ? (
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            A nota não impede salvar nem publicar.
          </p>
        ) : null}
      </div>
    </section>
  );
}
