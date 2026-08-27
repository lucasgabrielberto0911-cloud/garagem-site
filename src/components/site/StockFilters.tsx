"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconClose, IconSearch } from "@/components/site/icons";
import { useStockPendingOptional } from "@/components/site/StockPending";
import { formatBrandName } from "@/lib/format";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";

export type Facets = {
  categories?: string[];
  brands: string[];
  transmissions: string[];
  fuels: string[];
  colors?: string[];
  accessories?: string[];
  years: number[];
};

type FilterValues = {
  q: string;
  category: string;
  brand: string;
  transmission: string;
  fuel: string;
  color: string;
  accessory: string;
  laudo: string;
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  maxKm: string;
  sort: string;
};

type ActiveFilter = {
  key: Exclude<keyof FilterValues, "sort">;
  label: string;
  accessory?: string;
};

function splitAccessories(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinAccessories(items: string[]) {
  return items.join(",");
}

function toggleAccessoryValue(current: string, name: string) {
  const items = splitAccessories(current);
  const key = name.toLocaleLowerCase("pt-BR");
  const exists = items.some((item) => item.toLocaleLowerCase("pt-BR") === key);
  return joinAccessories(
    exists
      ? items.filter((item) => item.toLocaleLowerCase("pt-BR") !== key)
      : [...items, name],
  );
}

const CATEGORY_FILTER_OPTIONS = [
  { value: "", label: "Ambos" },
  { value: "carro", label: "Carro" },
  { value: "moto", label: "Moto" },
] as const;

const SORT_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "menor-km", label: "Menor KM" },
  { value: "mais-novo", label: "Ano mais novo" },
] as const;

/**
 * 16px no celular: abaixo disso o Safari do iPhone dá zoom ao focar o campo e
 * o visitante precisa pinçar de volta. No desktop mantém 14px pela densidade.
 */
const selectClass =
  "w-full min-h-[48px] border border-white/10 bg-asphalt px-3.5 py-3 text-base text-cream outline-none transition touch-manipulation focus:border-brand lg:text-sm";

const MIN_PRICE_OPTIONS = [
  { value: "", label: "Preço mínimo" },
  { value: "30000", label: "A partir de R$ 30 mil" },
  { value: "50000", label: "A partir de R$ 50 mil" },
  { value: "80000", label: "A partir de R$ 80 mil" },
  { value: "120000", label: "A partir de R$ 120 mil" },
  { value: "180000", label: "A partir de R$ 180 mil" },
] as const;

const MAX_PRICE_OPTIONS = [
  { value: "", label: "Preço máximo" },
  { value: "50000", label: "Até R$ 50 mil" },
  { value: "80000", label: "Até R$ 80 mil" },
  { value: "120000", label: "Até R$ 120 mil" },
  { value: "180000", label: "Até R$ 180 mil" },
  { value: "250000", label: "Até R$ 250 mil" },
] as const;

const KM_OPTIONS = [
  { value: "", label: "Qualquer KM" },
  { value: "20000", label: "Até 20 mil km" },
  { value: "50000", label: "Até 50 mil km" },
  { value: "80000", label: "Até 80 mil km" },
  { value: "120000", label: "Até 120 mil km" },
] as const;

export function StockFilters({ facets }: { facets: Facets }) {
  const router = useRouter();
  const params = useSearchParams();
  const { isPending, startTransition } = useStockPendingOptional();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);

  const current: FilterValues = {
    q: params.get("q") ?? "",
    category: params.get("category") ?? "",
    brand: params.get("brand") ?? "",
    transmission: params.get("transmission") ?? "",
    fuel: params.get("fuel") ?? "",
    color: params.get("color") ?? "",
    accessory: params.get("accessory") ?? "",
    laudo: params.get("laudo") ?? "",
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    minYear: params.get("minYear") ?? "",
    maxYear: params.get("maxYear") ?? "",
    maxKm: params.get("maxKm") ?? "",
    sort: params.get("sort") ?? "recentes",
  };
  const [draft, setDraft] = useState(current);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    sheetRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    setDraft(current);
    // URL params are the source of truth after navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const hasFilter = Object.entries(current).some(
    ([key, value]) => value && !(key === "sort" && value === "recentes"),
  );
  const activeFilterCount = [
    current.q,
    current.category,
    current.brand,
    current.transmission,
    current.fuel,
    current.color,
    current.accessory,
    current.laudo,
    current.minPrice,
    current.maxPrice,
    current.minYear,
    current.maxYear,
    current.maxKm,
  ].filter(Boolean).length;

  /** Só os campos que existem dentro do painel do celular (a busca fica fora). */
  const draftFilterCount = [
    draft.category,
    draft.brand,
    draft.transmission,
    draft.fuel,
    draft.color,
    draft.accessory,
    draft.laudo,
    draft.minPrice,
    draft.maxPrice,
    draft.minYear,
    draft.maxYear,
    draft.maxKm,
  ].filter(Boolean).length;

  const activeFilters: ActiveFilter[] = [];
  if (current.q) activeFilters.push({ key: "q", label: `Busca: “${current.q}”` });
  if (current.category) {
    activeFilters.push({
      key: "category",
      label: `Tipo: ${vehicleCategoryLabel(current.category)}`,
    });
  }
  if (current.brand) {
    activeFilters.push({
      key: "brand",
      label: `Marca: ${formatBrandName(current.brand)}`,
    });
  }
  if (current.transmission) {
    activeFilters.push({
      key: "transmission",
      label: `Câmbio: ${current.transmission}`,
    });
  }
  if (current.fuel) {
    activeFilters.push({ key: "fuel", label: `Combustível: ${current.fuel}` });
  }
  if (current.color) {
    activeFilters.push({ key: "color", label: `Cor: ${current.color}` });
  }
  for (const name of splitAccessories(current.accessory)) {
    activeFilters.push({
      key: "accessory",
      label: name,
      accessory: name,
    });
  }
  if (current.laudo) {
    activeFilters.push({ key: "laudo", label: "Com laudo" });
  }
  if (current.minPrice) {
    activeFilters.push({
      key: "minPrice",
      label: priceFilterLabel(current.minPrice, "mín."),
    });
  }
  if (current.maxPrice) {
    activeFilters.push({
      key: "maxPrice",
      label: priceFilterLabel(current.maxPrice, "máx."),
    });
  }
  if (current.minYear) {
    activeFilters.push({ key: "minYear", label: `Ano mín.: ${current.minYear}` });
  }
  if (current.maxYear) {
    activeFilters.push({ key: "maxYear", label: `Ano máx.: ${current.maxYear}` });
  }
  if (current.maxKm) {
    activeFilters.push({
      key: "maxKm",
      label: `Até ${formatCompactNumber(current.maxKm)} km`,
    });
  }

  function navigate(values: FilterValues) {
    const next = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value && !(key === "sort" && value === "recentes")) {
        next.set(key, String(value));
      }
    });
    // Nova busca/filtro volta à página 1.
    next.delete("page");
    const query = next.toString();
    startTransition(() => {
      const href = query ? `/estoque?${query}` : "/estoque";
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(min-width: 1024px)").matches
      ) {
        router.replace(href);
      } else {
        router.push(href);
      }
    });
  }

  function update(patch: Partial<FilterValues>) {
    navigate({ ...current, ...patch });
  }

  function clearFilters() {
    setOpen(false);
    navigate({
      q: "",
      category: "",
      brand: "",
      transmission: "",
      fuel: "",
      color: "",
      accessory: "",
      laudo: "",
      minPrice: "",
      maxPrice: "",
      minYear: "",
      maxYear: "",
      maxKm: "",
      sort: "recentes",
    });
  }

  return (
    <>
      <div
        aria-busy={isPending}
        data-pending={isPending}
        className={`border border-white/10 bg-ink p-4 transition-opacity sm:p-5 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:p-6 lg:pr-5 ${
          isPending ? "opacity-70" : ""
        }`}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = (
              event.currentTarget.elements.namedItem("q") as HTMLInputElement
            ).value;
            update({ q: value });
          }}
          className="mx-auto flex max-w-2xl gap-2 lg:flex-col lg:gap-3"
          role="search"
        >
          <div className="flex min-h-[48px] flex-1 items-center gap-2.5 border border-white/10 bg-asphalt px-3.5 transition focus-within:border-brand lg:min-h-[52px]">
            <IconSearch className="h-4 w-4 shrink-0 text-muted" />
            <label htmlFor="estoque-busca" className="sr-only">
              Buscar por marca, modelo ou versão
            </label>
            <input
              id="estoque-busca"
              name="q"
              type="search"
              defaultValue={current.q}
              key={current.q}
              placeholder="Marca, modelo ou versão"
              className="w-full min-w-0 bg-transparent py-3 text-base text-cream placeholder:text-muted focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            aria-label="Buscar"
            className="min-h-[48px] bg-brand px-4 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] disabled:opacity-70 sm:px-6 lg:min-h-[52px] lg:w-full"
          >
            <span className="hidden sm:inline">{isPending ? "Buscando..." : "Buscar"}</span>
            <IconSearch className="h-5 w-5 sm:hidden" />
          </button>
        </form>

        {/* Desktop: filtros completos. */}
        <div className="mt-6 hidden lg:block">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
            <FilterIcon />
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
              Filtrar estoque
            </h2>
          </div>

          <div className="mt-5 space-y-4">
            <DesktopField label="Tipo" htmlFor="desktop-tipo">
              <select
                id="desktop-tipo"
                value={current.category}
                onChange={(event) => update({ category: event.target.value })}
                className={selectClass}
              >
                {CATEGORY_FILTER_OPTIONS.map((option) => (
                  <option key={option.value || "ambos"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </DesktopField>
            <FilterSelect
              label="Marca"
              id="desktop-marca"
              value={current.brand}
              onChange={(value) => update({ brand: value })}
              options={facets.brands}
              emptyLabel="Todas as marcas"
            />
            <FilterSelect
              label="Câmbio"
              id="desktop-cambio"
              value={current.transmission}
              onChange={(value) => update({ transmission: value })}
              options={facets.transmissions}
              emptyLabel="Todos os câmbios"
            />
            <FilterSelect
              label="Combustível"
              id="desktop-combustivel"
              value={current.fuel}
              onChange={(value) => update({ fuel: value })}
              options={facets.fuels}
              emptyLabel="Todos os combustíveis"
            />
            {(facets.colors ?? []).length > 0 ? (
              <FilterSelect
                label="Cor"
                id="desktop-cor"
                value={current.color}
                onChange={(value) => update({ color: value })}
                options={facets.colors ?? []}
                emptyLabel="Todas as cores"
              />
            ) : null}
            {(facets.accessories ?? []).length > 0 ? (
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                  Acessórios
                </p>
                <AccessoryChips
                  options={facets.accessories ?? []}
                  value={current.accessory}
                  onToggle={(name) =>
                    update({
                      accessory: toggleAccessoryValue(current.accessory, name),
                    })
                  }
                />
              </div>
            ) : null}
            <label className="flex min-h-[48px] cursor-pointer items-center gap-2.5 border border-white/10 bg-asphalt px-3.5 text-sm text-cream">
              <input
                type="checkbox"
                checked={Boolean(current.laudo)}
                onChange={(event) =>
                  update({ laudo: event.target.checked ? "1" : "" })
                }
                className="h-4 w-4 accent-brand"
              />
              Com laudo
            </label>
            <DesktopField label="Preço mínimo" htmlFor="desktop-preco-min">
              <select
                id="desktop-preco-min"
                value={current.minPrice}
                onChange={(event) => update({ minPrice: event.target.value })}
                className={selectClass}
              >
                {MIN_PRICE_OPTIONS.map((option) => (
                  <option key={option.value || "min"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </DesktopField>
            <DesktopField label="Preço máximo" htmlFor="desktop-preco-max">
              <select
                id="desktop-preco-max"
                value={current.maxPrice}
                onChange={(event) => update({ maxPrice: event.target.value })}
                className={selectClass}
              >
                {MAX_PRICE_OPTIONS.map((option) => (
                  <option key={option.value || "max"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </DesktopField>
            <DesktopField label="Ano mínimo" htmlFor="desktop-ano-min">
              <select
                id="desktop-ano-min"
                value={current.minYear}
                onChange={(event) => update({ minYear: event.target.value })}
                className={selectClass}
              >
                <option value="">Qualquer ano</option>
                {facets.years.map((year) => (
                  <option key={`min-${year}`} value={year}>
                    A partir de {year}
                  </option>
                ))}
              </select>
            </DesktopField>
            <DesktopField label="Ano máximo" htmlFor="desktop-ano-max">
              <select
                id="desktop-ano-max"
                value={current.maxYear}
                onChange={(event) => update({ maxYear: event.target.value })}
                className={selectClass}
              >
                <option value="">Qualquer ano</option>
                {facets.years.map((year) => (
                  <option key={`max-${year}`} value={year}>
                    Até {year}
                  </option>
                ))}
              </select>
            </DesktopField>
            <DesktopField label="Quilometragem" htmlFor="desktop-km">
              <select
                id="desktop-km"
                value={current.maxKm}
                onChange={(event) => update({ maxKm: event.target.value })}
                className={selectClass}
              >
                {KM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </DesktopField>
          </div>

          <DesktopField
            label="Ordenar resultados"
            htmlFor="estoque-ordem"
            className="mt-5 border-t border-white/10 pt-5"
          >
            <select
              id="estoque-ordem"
              value={current.sort}
              onChange={(event) => update({ sort: event.target.value })}
              className={selectClass}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </DesktopField>

          {activeFilters.length > 0 ? (
            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                Filtros ativos
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <button
                    key={filter.accessory ? `accessory:${filter.accessory}` : filter.key}
                    type="button"
                    onClick={() =>
                      update({
                        [filter.key]:
                          filter.key === "accessory" && filter.accessory
                            ? toggleAccessoryValue(current.accessory, filter.accessory)
                            : "",
                      })
                    }
                    className="inline-flex min-h-[44px] items-center gap-1.5 border border-brand/50 bg-brand/10 px-2.5 py-1.5 text-left text-[11px] leading-tight text-cream transition hover:border-brand"
                    aria-label={`Remover ${filter.label}`}
                  >
                    <span>{filter.label}</span>
                    <IconClose className="h-3 w-3 shrink-0 text-brand" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {hasFilter ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 min-h-[44px] w-full border border-white/15 px-3 font-display text-xs font-semibold uppercase tracking-wider text-muted transition hover:border-brand hover:text-cream"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => {
              setDraft(current);
              setOpen(true);
            }}
            className="relative inline-flex min-h-[44px] items-center gap-2 border border-white/15 px-4 font-display text-xs font-semibold uppercase tracking-wide text-cream"
          >
            <FilterIcon />
            Filtros
            {activeFilterCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>

          {hasFilter ? (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-[44px] px-2 text-xs uppercase tracking-wider text-muted underline-offset-4 transition hover:text-cream hover:underline"
            >
              Limpar
            </button>
          ) : null}
        </div>

        {activeFilters.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 lg:hidden">
            {activeFilters.map((filter) => (
              <button
                key={filter.accessory ? `accessory:${filter.accessory}` : filter.key}
                type="button"
                onClick={() =>
                  update({
                    [filter.key]:
                      filter.key === "accessory" && filter.accessory
                        ? toggleAccessoryValue(current.accessory, filter.accessory)
                        : "",
                  })
                }
                className="inline-flex min-h-[44px] items-center gap-1.5 border border-brand/50 bg-brand/10 px-2.5 py-1.5 text-left text-[11px] leading-tight text-cream"
                aria-label={`Remover ${filter.label}`}
              >
                <span>{filter.label}</span>
                <IconClose className="h-3 w-3 shrink-0 text-brand" />
              </button>
            ))}
          </div>
        ) : null}

        {/* Mobile/tablet: ordenação em faixa horizontal. */}
        <div className="mt-3 lg:hidden">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update({ sort: option.value })}
                className={`min-h-[44px] shrink-0 whitespace-nowrap border px-3.5 text-xs font-medium transition touch-manipulation ${
                  current.sort === option.value
                    ? "border-brand bg-brand/10 text-cream"
                    : "border-white/10 text-muted active:bg-white/5"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Fechar filtros"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm animate-fade-in"
          />
          <section
            ref={sheetRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-filtros"
            className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto overscroll-contain border-t border-white/10 bg-ink animate-slide-up pb-safe focus:outline-none"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-ink/95 px-5 py-4 backdrop-blur">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-brand">Estoque</p>
                <h2 id="titulo-filtros" className="font-display text-lg font-semibold text-cream">
                  Filtrar veículos
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center border border-white/15 text-cream"
                aria-label="Fechar"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-5 py-6">
              <MobileField label="Tipo">
                <select
                  value={draft.category}
                  onChange={(event) =>
                    setDraft({ ...draft, category: event.target.value })
                  }
                  className={selectClass}
                >
                  {CATEGORY_FILTER_OPTIONS.map((option) => (
                    <option key={option.value || "ambos"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </MobileField>
              <MobileField label="Marca">
                <select
                  value={draft.brand}
                  onChange={(event) => setDraft({ ...draft, brand: event.target.value })}
                  className={selectClass}
                >
                  <option value="">Todas as marcas</option>
                  {facets.brands.map((item) => <option key={item}>{item}</option>)}
                </select>
              </MobileField>
              <MobileField label="Câmbio">
                <select
                  value={draft.transmission}
                  onChange={(event) => setDraft({ ...draft, transmission: event.target.value })}
                  className={selectClass}
                >
                  <option value="">Todos os câmbios</option>
                  {facets.transmissions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </MobileField>
              <MobileField label="Combustível">
                <select
                  value={draft.fuel}
                  onChange={(event) => setDraft({ ...draft, fuel: event.target.value })}
                  className={selectClass}
                >
                  <option value="">Todos os combustíveis</option>
                  {facets.fuels.map((item) => <option key={item}>{item}</option>)}
                </select>
              </MobileField>
              {(facets.colors ?? []).length > 0 ? (
                <MobileField label="Cor">
                  <select
                    value={draft.color}
                    onChange={(event) => setDraft({ ...draft, color: event.target.value })}
                    className={selectClass}
                  >
                    <option value="">Todas as cores</option>
                    {(facets.colors ?? []).map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </MobileField>
              ) : null}
              {(facets.accessories ?? []).length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
                    Acessórios
                  </p>
                  <AccessoryChips
                    options={facets.accessories ?? []}
                    value={draft.accessory}
                    onToggle={(name) =>
                      setDraft({
                        ...draft,
                        accessory: toggleAccessoryValue(draft.accessory, name),
                      })
                    }
                  />
                </div>
              ) : null}
              <label className="flex min-h-[48px] cursor-pointer items-center gap-2.5 border border-white/10 bg-asphalt px-3.5 text-sm text-cream">
                <input
                  type="checkbox"
                  checked={Boolean(draft.laudo)}
                  onChange={(event) =>
                    setDraft({ ...draft, laudo: event.target.checked ? "1" : "" })
                  }
                  className="h-4 w-4 accent-brand"
                />
                Com laudo
              </label>
              <MobileField label="Preço mínimo">
                <select
                  value={draft.minPrice}
                  onChange={(event) => setDraft({ ...draft, minPrice: event.target.value })}
                  className={selectClass}
                >
                  {MIN_PRICE_OPTIONS.map((option) => (
                    <option key={option.value || "min"} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </MobileField>
              <MobileField label="Preço máximo">
                <select
                  value={draft.maxPrice}
                  onChange={(event) => setDraft({ ...draft, maxPrice: event.target.value })}
                  className={selectClass}
                >
                  {MAX_PRICE_OPTIONS.map((option) => (
                    <option key={option.value || "max"} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </MobileField>
              <MobileField label="Ano mínimo">
                <select
                  value={draft.minYear}
                  onChange={(event) => setDraft({ ...draft, minYear: event.target.value })}
                  className={selectClass}
                >
                  <option value="">Qualquer</option>
                  {facets.years.map((year) => (
                    <option key={`m-min-${year}`} value={year}>{year}</option>
                  ))}
                </select>
              </MobileField>
              <MobileField label="Ano máximo">
                <select
                  value={draft.maxYear}
                  onChange={(event) => setDraft({ ...draft, maxYear: event.target.value })}
                  className={selectClass}
                >
                  <option value="">Qualquer</option>
                  {facets.years.map((year) => (
                    <option key={`m-max-${year}`} value={year}>{year}</option>
                  ))}
                </select>
              </MobileField>
              <MobileField label="Quilometragem máxima">
                <select
                  value={draft.maxKm}
                  onChange={(event) => setDraft({ ...draft, maxKm: event.target.value })}
                  className={selectClass}
                >
                  {KM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </MobileField>
            </div>

            <div className="sticky bottom-0 grid grid-cols-[auto_1fr] gap-3 border-t border-white/10 bg-ink/95 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] backdrop-blur">
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    category: "",
                    brand: "",
                    transmission: "",
                    fuel: "",
                    color: "",
                    accessory: "",
                    laudo: "",
                    minPrice: "",
                    maxPrice: "",
                    minYear: "",
                    maxYear: "",
                    maxKm: "",
                  })
                }
                className="min-h-[52px] border border-white/15 px-5 font-display text-xs font-semibold uppercase tracking-wide text-muted"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(draft);
                }}
                className="min-h-[52px] bg-brand px-5 font-display text-xs font-semibold uppercase tracking-wide text-white"
              >
                {draftFilterCount > 0
                  ? `Aplicar filtros (${draftFilterCount})`
                  : "Aplicar filtros"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function AccessoryChips({
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
                  : "border-white/10 text-muted hover:border-white/25 hover:text-cream"
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

function FilterSelect({
  label,
  id,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  emptyLabel: string;
}) {
  return (
    <DesktopField label={label} htmlFor={id}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass}
      >
        <option value="">{emptyLabel}</option>
        {options.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </DesktopField>
  );
}

function DesktopField({
  label,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function formatCompactNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("pt-BR").format(number)
    : value;
}

function priceFilterLabel(value: string, qualifier: "mín." | "máx.") {
  return `Preço ${qualifier}: R$ ${formatCompactNumber(value)}`;
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  );
}
