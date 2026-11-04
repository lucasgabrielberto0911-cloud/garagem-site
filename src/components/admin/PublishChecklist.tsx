"use client";

import type {
  VehicleFormSectionId,
  VehicleWizardStep,
} from "@/lib/admin-form-sections";
import {
  publishMissingItems,
  publishMissingLine,
  type PublishGapId,
  type PublishGapInput,
  type PublishGapItem,
} from "@/lib/stock-quality";

export {
  publishMissingItems,
  publishMissingLine,
  publishMissingItems as publishChecklistItems,
  publishMissingLine as publishChecklistLine,
  type PublishGapId,
  type PublishGapInput,
  type PublishGapItem,
};

/**
 * Foca o campo correspondente na tela quando a pessoa toca num item de "Falta: ...".
 */
export function focusPublishGapField(
  item: Pick<PublishGapItem, "field">,
  root?: ParentNode | null,
) {
  if (typeof document === "undefined") return;
  const scope = root ?? document.getElementById("vehicle-form") ?? document;

  if (item.field === "photos") {
    const fileControl = scope.querySelector<HTMLElement>(
      '#secao-fotos input[type="file"], #secao-fotos button',
    );
    const target = fileControl ?? document.getElementById("wizard-title");
    target?.focus();
    return;
  }

  if (item.field === "locationCity") {
    const cityControl = scope.querySelector<HTMLElement>(
      '[aria-label="Onde está o veículo"] button, [name="locationCity"]',
    );
    cityControl?.focus();
    return;
  }

  if (item.field === "description" || item.field === "accessories") {
    const legend =
      document.getElementById("vehicle-legend") ??
      scope.querySelector<HTMLElement>('[name="description"]');
    legend?.focus();
    return;
  }

  const candidates =
    item.field === "priceDisplay"
      ? ["priceDisplay", "price"]
      : item.field === "kmDisplay"
        ? ["kmDisplay", "km"]
        : [item.field];

  for (const name of candidates) {
    const element = scope.querySelector<HTMLElement>(`[name="${name}"]`);
    if (
      element &&
      !(element instanceof HTMLInputElement && element.type === "hidden")
    ) {
      element.focus();
      return;
    }
  }
}

export type PublishChecklistProps = {
  /** Lista já calculada de pendências, ou omitida quando `draft` é passado. */
  items?: readonly PublishGapItem[];
  /** Dados do anúncio para calcular as pendências quando `items` não é passado. */
  draft?: PublishGapInput;
  /** Prefixo exibido no início da linha (padrão: "Falta:"). */
  prefix?: string;
  /** Callback ao tocar em um item (ex.: mudar seção/etapa). */
  onJump?: (
    section: VehicleFormSectionId,
    field: string,
    step: VehicleWizardStep,
  ) => void;
  /** Callback com o item completo ao tocar. */
  onSelect?: (item: PublishGapItem) => void;
  className?: string;
};

/**
 * Linha única "Falta: foto de capa, preço" antes de publicar (M3 / X4).
 * Sem cartão novo: quando nada falta, retorna null e some da tela.
 */
export function PublishChecklist({
  items,
  draft,
  prefix = "Falta:",
  onJump,
  onSelect,
  className = "",
}: PublishChecklistProps) {
  const resolved = items ?? (draft ? publishMissingItems(draft) : []);
  if (resolved.length === 0) return null;

  function handleSelect(item: PublishGapItem) {
    onSelect?.(item);
    onJump?.(item.section, item.field, item.step);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        focusPublishGapField(item);
      });
    }
  }

  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="publish-checklist"
      className={`text-xs leading-relaxed text-muted sm:text-sm ${className}`.trim()}
    >
      <span className="font-medium text-cream">{prefix}</span>{" "}
      {resolved.map((item, index) => (
        <span key={item.id}>
          {index > 0 ? ", " : null}
          <button
            type="button"
            onClick={() => handleSelect(item)}
            className="inline min-h-[28px] py-1 text-left font-medium text-red-400 underline decoration-red-400/50 underline-offset-4 transition hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand touch-manipulation"
          >
            {item.label}
          </button>
        </span>
      ))}
    </p>
  );
}

export default PublishChecklist;
