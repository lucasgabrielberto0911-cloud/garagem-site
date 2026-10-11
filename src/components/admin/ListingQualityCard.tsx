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

function scoredDateLabel(scoredAt: string | null) {
  if (!scoredAt) return null;
  const date = new Date(scoredAt);
  if (Number.isNaN(date.getTime())) return null;
  return `Calculada ao salvar em ${date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })}.`;
}

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

/**
 * Mostra a nota gravada no último Salvar com alteração. Este componente nunca
 * chama o Jev: abrir o admin ou editar campos não gasta nada. A nota é
 * recalculada no servidor só quando o anúncio é salvo com mudança.
 */
export function ListingQualityCard({
  draft,
  coverUrl,
  judgment,
  scoredAt,
  dirty,
  saving,
  onJump,
}: {
  draft: ListingDraft;
  coverUrl: string;
  judgment: ListingJudgment | null;
  scoredAt: string | null;
  dirty: boolean;
  saving: boolean;
  onJump: (section: VehicleFormSectionId) => void;
}) {
  const coverWarnings = useCoverWarnings(coverUrl);
  const [showAll, setShowAll] = useState(false);

  if (draft.status === "vendido") return null;

  const stored = isListingJudgment(judgment) ? judgment : null;
  const view = presentListing({ ...draft, coverWarnings }, stored);
  if (!view.prompt && view.advice.length === 0 && !view.clearNote && !view.grade) {
    return null;
  }

  const statusLine = view.prompt
    ? view.prompt
    : view.grade
      ? view.grade.label
      : null;
  const scoreHint = view.prompt
    ? null
    : saving && dirty
      ? "Salvando… a nota é atualizada junto."
      : view.grade && dirty
        ? "Nota do último salvamento. Salve para atualizar."
        : view.grade
          ? scoredDateLabel(scoredAt)
          : "A nota do Jev sai quando você salvar uma alteração.";
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

        {scoreHint ? (
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            {scoreHint}
          </p>
        ) : null}

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
