"use client";

import { PublishChecklist } from "@/components/admin/PublishChecklist";
import type { VehicleFormSectionId } from "@/lib/admin-form-sections";
import {
  assessCoverPhoto,
  coverAssessmentSrc,
} from "@/lib/cover-photo-quality";
import {
  isListingJudgment,
  presentListing,
  type ListingDraft,
  type ListingJudgment,
} from "@/lib/listing-present";
import { publishMissingItems } from "@/lib/stock-quality";
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
  const [result, setResult] = useState<{
    url: string;
    warnings: string[];
  } | null>(null);

  useEffect(() => {
    if (!url) return;
    let active = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    const finish = (warnings: string[]) => {
      if (active) setResult({ url, warnings });
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

  if (!url) return [];
  return result?.url === url ? result.warnings : [];
}

/**
 * Linha "Falta: ..." (PublishChecklist) + nota do último Salvar recolhida.
 * Mede a capa pela miniatura (nunca baixa a foto inteira) e nunca chama o Jev no navegador.
 */
export function ListingQualityCard({
  draft,
  coverUrl,
  coverThumbnailUrl,
  judgment,
  scoredAt,
  dirty,
  saving,
  onJump,
}: {
  draft: ListingDraft;
  coverUrl: string;
  coverThumbnailUrl?: string | null;
  judgment: ListingJudgment | null;
  scoredAt: string | null;
  dirty: boolean;
  saving: boolean;
  onJump: (section: VehicleFormSectionId) => void;
}) {
  const thumbnailSrc =
    draft.status !== "vendido" && draft.photoCount > 0
      ? coverAssessmentSrc(coverUrl, coverThumbnailUrl)
      : "";
  const coverWarnings = useCoverWarnings(thumbnailSrc);

  if (draft.status === "vendido") return null;

  const missingItems = publishMissingItems(draft);
  const stored = isListingJudgment(judgment) ? judgment : null;
  const view = presentListing({ ...draft, coverWarnings }, stored);

  const missingIds = new Set<string>(missingItems.map((item) => item.id));
  const extraAdvice = view.advice.filter((item) => !missingIds.has(item.id));

  if (
    missingItems.length === 0 &&
    !view.grade &&
    extraAdvice.length === 0
  ) {
    return null;
  }

  const scoreText = view.grade
    ? view.grade.score.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : null;

  const scoreHint = saving && dirty
    ? "Salvando… a nota é atualizada junto."
    : view.grade && dirty
      ? "Nota do último salvamento. Salve para atualizar."
      : view.grade
        ? scoredDateLabel(scoredAt)
        : null;

  return (
    <div aria-label="Força do anúncio" className="space-y-1.5">
      <PublishChecklist
        items={missingItems}
        onJump={(section) => onJump(section)}
      />

      {extraAdvice.length > 0 ? (
        <details className="group text-xs text-muted sm:text-sm">
          <summary className="cursor-pointer select-none py-1 leading-relaxed text-muted hover:text-cream">
            {view.grade && scoreText ? (
              <span>
                Nota do anúncio:{" "}
                <strong
                  className={
                    view.grade.label === "Fraco"
                      ? "font-semibold text-red-400"
                      : "font-semibold text-cream"
                  }
                >
                  {scoreText}/10 ({view.grade.label})
                </strong>{" "}
                · {extraAdvice.length}{" "}
                {extraAdvice.length === 1
                  ? "sugestão opcional"
                  : "sugestões opcionais"}
              </span>
            ) : (
              <span>
                Sugestões opcionais ({extraAdvice.length}):{" "}
                {extraAdvice.map((item) => item.title.toLowerCase()).join(", ")}
              </span>
            )}
          </summary>
          <div className="mt-1 space-y-1 border-l border-white/10 pl-3">
            {scoreHint ? (
              <p className="text-xs leading-relaxed text-muted">{scoreHint}</p>
            ) : null}
            <ul className="divide-y divide-white/10">
              {extraAdvice.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onJump(item.section)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left touch-manipulation"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-cream">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                        {item.detail}
                      </span>
                    </span>
                    <span
                      className="shrink-0 font-display text-lg leading-none text-muted"
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : view.grade && scoreText ? (
        <p className="text-xs leading-relaxed text-muted sm:text-sm">
          Nota do anúncio:{" "}
          <strong
            className={
              view.grade.label === "Fraco"
                ? "font-semibold text-red-400"
                : "font-semibold text-cream"
            }
          >
            {scoreText}/10 ({view.grade.label})
          </strong>
          {scoreHint ? ` · ${scoreHint}` : ""}
        </p>
      ) : null}
    </div>
  );
}
