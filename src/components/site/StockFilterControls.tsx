"use client";

import { useState, type ReactNode } from "react";

export function splitAccessories(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinAccessories(items: string[]) {
  return items.join(",");
}

export function toggleAccessoryValue(current: string, name: string) {
  const items = splitAccessories(current);
  const key = name.toLocaleLowerCase("pt-BR");
  const exists = items.some((item) => item.toLocaleLowerCase("pt-BR") === key);
  return joinAccessories(
    exists
      ? items.filter((item) => item.toLocaleLowerCase("pt-BR") !== key)
      : [...items, name],
  );
}

export const CATEGORY_FILTER_OPTIONS = [
  { value: "", label: "Ambos" },
  { value: "carro", label: "Carro" },
  { value: "moto", label: "Moto" },
] as const;

export const BUDGET_CHIPS = [
  { label: "Até 30 mil", minPrice: "", maxPrice: "30000" },
  { label: "Até 50 mil", minPrice: "", maxPrice: "50000" },
  { label: "50 a 80 mil", minPrice: "50000", maxPrice: "80000" },
  { label: "80 a 120 mil", minPrice: "80000", maxPrice: "120000" },
  { label: "Acima de 120 mil", minPrice: "120000", maxPrice: "" },
] as const;

/**
 * 16px no celular/iPad: abaixo disso o Safari dá zoom ao focar o campo.
 * No Mac (pointer fino) `lg:text-sm` mantém 14px; globals.css força 16px
 * em ponteiro grosso e em iOS/iPadOS (`-webkit-touch-callout`).
 */
export const selectClass =
  "w-full min-h-[48px] border border-white/10 bg-asphalt px-3.5 py-3 text-base text-cream outline-none transition touch-manipulation focus:border-brand lg:text-sm";

export const MIN_PRICE_OPTIONS = [
  { value: "", label: "Preço mínimo" },
  { value: "15000", label: "A partir de R$ 15 mil" },
  { value: "30000", label: "A partir de R$ 30 mil" },
  { value: "50000", label: "A partir de R$ 50 mil" },
  { value: "80000", label: "A partir de R$ 80 mil" },
  { value: "120000", label: "A partir de R$ 120 mil" },
  { value: "180000", label: "A partir de R$ 180 mil" },
] as const;

export const MAX_PRICE_OPTIONS = [
  { value: "", label: "Preço máximo" },
  { value: "20000", label: "Até R$ 20 mil" },
  { value: "35000", label: "Até R$ 35 mil" },
  { value: "50000", label: "Até R$ 50 mil" },
  { value: "80000", label: "Até R$ 80 mil" },
  { value: "120000", label: "Até R$ 120 mil" },
  { value: "180000", label: "Até R$ 180 mil" },
  { value: "250000", label: "Até R$ 250 mil" },
] as const;

export const KM_OPTIONS = [
  { value: "", label: "Qualquer KM" },
  { value: "20000", label: "Até 20 mil km" },
  { value: "50000", label: "Até 50 mil km" },
  { value: "80000", label: "Até 80 mil km" },
  { value: "120000", label: "Até 120 mil km" },
] as const;

export function selectedOption(options: string[], value: string) {
  const key = value.trim().toLocaleLowerCase("pt-BR");
  if (!key) return "";
  return options.find((item) => item.toLocaleLowerCase("pt-BR") === key) ?? value;
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap border px-3 text-xs font-medium leading-none transition touch-manipulation ${
        active
          ? "border-brand bg-brand/10 text-cream"
          : "border-white/10 text-muted active:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

export function AccessoryChips({
  options,
  value,
  onToggle,
}: {
  options: string[];
  value: string;
  onToggle: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const selected = new Set(
    splitAccessories(value).map((item) => item.toLocaleLowerCase("pt-BR")),
  );
  const visible = expanded ? options : options.slice(0, 8);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {visible.map((item) => {
          const active = selected.has(item.toLocaleLowerCase("pt-BR"));
          return (
            <button
              key={item}
              type="button"
              onClick={() => onToggle(item)}
              className={`min-h-[44px] border px-3 text-left text-xs transition touch-manipulation ${
                active
                  ? "border-brand bg-brand/10 text-cream"
                  : "border-white/10 text-muted hover:border-white/25 hover:text-cream active:border-white/25 active:text-cream"
              }`}
              aria-pressed={active}
            >
              {item}
            </button>
          );
        })}
      </div>
      {options.length > 8 ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="mt-2 min-h-[44px] text-xs font-semibold uppercase tracking-wide text-brand"
        >
          {expanded ? "Ver menos" : `Ver mais (${options.length - 8})`}
        </button>
      ) : null}
    </div>
  );
}

export function formatCompactNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("pt-BR").format(number)
    : value;
}
