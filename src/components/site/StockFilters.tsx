"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { CATEGORY_FILTER_OPTIONS, BUDGET_CHIPS, MIN_PRICE_OPTIONS, MAX_PRICE_OPTIONS, KM_OPTIONS, selectClass, selectedOption, toggleAccessoryValue, splitAccessories, AccessoryChips, Chip, formatCompactNumber } from "./StockFilterControls";
import { IconClose, IconSearch, IconShare } from "@/components/site/icons";
import { useStockPendingOptional } from "@/components/site/StockPending";
import { formatBrandName, formatModelName } from "@/lib/format";
import {
  modelAfterBrandChange,
  modelFilterOptions,
  STOCK_SORT_OPTIONS,
  type StockModelOption,
} from "@/lib/stock-query";
import { handleFocusTrap } from "@/lib/focus-trap";
import { chipTrackInsets } from "@/lib/stock-chip-track";
import {
  formatColorLabel,
  transmissionFilterLabel,
  transmissionFilterOptions,
  transmissionFilterParam,
} from "@/lib/vehicle-display";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";

import { ShareStockSearch } from "./ShareStockSearch";

export type Facets = {
  categories?: string[];
  brands: string[];
  models?: StockModelOption[];
  transmissions: string[];
  fuels: string[];
  colors?: string[];
  accessories?: string[];
  years: number[];
};

export type FilterValues = {
  q: string;
  category: string;
  brand: string;
  model: string;
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

function ShareSearchButton({ className = "" }: { className?: string }) {
  return <ShareStockSearch className={className} icon={<IconShare className="h-4 w-4" />} />;
}

export function StockFilters({ facets }: { facets: Facets }) {
  const router = useRouter();
  const params = useSearchParams();
  const { isPending, startTransition } = useStockPendingOptional();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const current: FilterValues = {
    q: params.get("q") ?? "",
    category: params.get("category") ?? "",
    brand: params.get("brand") ?? "",
    model: params.get("model") ?? "",
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
  const [FilterFields, setFilterFields] = useState<ComponentType<import("./StockFilterFields").StockFilterFieldsProps> | null>(null);
  const [fieldsFailed, setFieldsFailed] = useState(false);
  const [fieldsAttempt, setFieldsAttempt] = useState(0);

  useEffect(() => {
    if (!open || FilterFields) return;
    let cancelled = false;
    setFieldsFailed(false);
    const deadline = window.setTimeout(() => {
      cancelled = true;
      setFieldsFailed(true);
    }, 15000);
    void import("./StockFilterFields").then(module => {
      if (cancelled) return;
      window.clearTimeout(deadline);
      setFilterFields(() => module.StockFilterFields);
    }).catch(() => {
      if (cancelled) return;
      window.clearTimeout(deadline);
      setFieldsFailed(true);
    });
    return () => { cancelled = true; window.clearTimeout(deadline); };
  }, [open, FilterFields, fieldsAttempt]);

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    document.body.style.overflow = "hidden";
    document.body.setAttribute("data-filters-open", "");
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      document.body.style.overflow = "";
      document.body.removeAttribute("data-filters-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const filterButton = filterButtonRef.current;
    const trigger = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : filterButtonRef.current;
    sheetRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (sheetRef.current) handleFocusTrap(event, sheetRef.current);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (trigger?.isConnected && trigger !== document.body) trigger.focus({ preventScroll: true });
      else filterButton?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    setDraft(current);
    // URL params are the source of truth after navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const hasFilter = Object.entries(current).some(
    ([key, value]) => value && !(key === "sort" && value === "recentes"),
  );
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
  if (current.model) {
    activeFilters.push({
      key: "model",
      label: `Modelo: ${formatModelName(current.model)}`,
    });
  }
  if (current.transmission) {
    activeFilters.push({
      key: "transmission",
      label: `Câmbio: ${transmissionFilterLabel(current.transmission)}`,
    });
  }
  if (current.fuel) {
    activeFilters.push({ key: "fuel", label: `Combustível: ${current.fuel}` });
  }
  if (current.color) {
    activeFilters.push({
      key: "color",
      label: `Cor: ${formatColorLabel(current.color) || current.color}`,
    });
  }
  for (const name of splitAccessories(current.accessory)) {
    activeFilters.push({
      key: "accessory",
      label: name,
      accessory: name,
    });
  }
  if (current.laudo) {
    activeFilters.push({ key: "laudo", label: "Com vistoria da loja" });
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

  const activeFilterCount = activeFilters.length;

  function removeFilter(filter: ActiveFilter) {
    if (filter.key === "brand") {
      update({ brand: "", model: "" });
      return;
    }
    update({
      [filter.key]:
        filter.key === "accessory" && filter.accessory
          ? toggleAccessoryValue(current.accessory, filter.accessory)
          : "",
    });
  }

  function navigate(values: FilterValues) {
    const normalized: FilterValues = {
      ...values,
      transmission: transmissionFilterParam(values.transmission),
    };
    const next = new URLSearchParams();
    Object.entries(normalized).forEach(([key, value]) => {
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
      } else if (window.location.pathname === "/estoque") {
        // A lista já busca a API ao mudar a URL; não refaça o payload da página.
        if (href !== window.location.pathname + window.location.search) {
          window.history.pushState(null, "", href);
        }
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
      model: "",
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

  const gearOptions = transmissionFilterOptions(
    facets.transmissions,
    current.transmission,
  );
  const gearValue = transmissionFilterParam(current.transmission);

  return (
    <>
      <div
        aria-busy={isPending}
        data-pending={isPending}
        className={`border border-white/10 bg-ink p-4 transition-opacity sm:p-5 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:p-6 lg:pr-5 ${
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
            <DesktopField label="Ordenar resultados" htmlFor="estoque-ordem">
              <select
                id="estoque-ordem"
                value={current.sort}
                onChange={(event) => update({ sort: event.target.value })}
                className={selectClass}
              >
                {STOCK_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </DesktopField>
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
              onChange={(value) =>
                update({
                  brand: value,
                  model: modelAfterBrandChange(facets.models, value, current.model),
                })
              }
              options={facets.brands}
              emptyLabel="Todas as marcas"
            />
            <FilterSelect
              label="Modelo"
              id="desktop-modelo"
              value={selectedOption(
                modelFilterOptions(facets.models, current.brand, current.model),
                current.model,
              )}
              onChange={(value) => update({ model: value })}
              options={modelFilterOptions(facets.models, current.brand, current.model)}
              emptyLabel="Todos os modelos"
            />
            <FilterSelect
              label="Câmbio"
              id="desktop-cambio"
              value={gearValue}
              onChange={(value) => update({ transmission: value })}
              options={gearOptions}
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
              Com vistoria da loja
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

          {activeFilters.length > 0 ? (
            <div className="mt-5 border-t border-white/10 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                  Filtros ativos
                </p>
                <ShareSearchButton />
              </div>
              <ActiveFilterChips filters={activeFilters} onRemove={removeFilter} />
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

      </div>

      <div
        data-stock-filters=""
        className="stock-chip-bar mt-3 border border-white/10 bg-ink px-3 py-2.5 lg:hidden"
      >
        <MobileChipRow label="Faixa">
          {BUDGET_CHIPS.map((chip) => {
            const active =
              (current.minPrice || "") === chip.minPrice &&
              (current.maxPrice || "") === chip.maxPrice;
            return (
              <Chip
                key={`sticky-${chip.label}`}
                active={active}
                onClick={() =>
                  update(
                    active
                      ? { minPrice: "", maxPrice: "" }
                      : { minPrice: chip.minPrice, maxPrice: chip.maxPrice },
                  )
                }
              >
                {chip.label}
              </Chip>
            );
          })}
        </MobileChipRow>
        {facets.brands.length > 0 ? (
          <MobileChipRow label="Marca">
            {visibleBrandChips(facets.brands, current.brand).map((item) => (
              <Chip
                key={`sticky-brand-${item}`}
                active={current.brand === item}
                onClick={() => {
                  const brand = current.brand === item ? "" : item;
                  update({
                    brand,
                    model: modelAfterBrandChange(facets.models, brand, current.model),
                  });
                }}
              >
                {formatBrandName(item)}
              </Chip>
            ))}
            {facets.brands.length > 8 ? (
              <Chip
                active={Boolean(
                  current.brand &&
                    !visibleBrandChips(facets.brands, current.brand).includes(
                      current.brand,
                    ),
                )}
                onClick={() => {
                  setDraft(current);
                  setOpen(true);
                }}
              >
                Outras
              </Chip>
            ) : null}
          </MobileChipRow>
        ) : null}
        {current.brand &&
        modelFilterOptions(facets.models, current.brand, current.model).length > 0 ? (
          <MobileChipRow label="Modelo">
            {visibleBrandChips(
              modelFilterOptions(facets.models, current.brand, current.model),
              selectedOption(
                modelFilterOptions(facets.models, current.brand, current.model),
                current.model,
              ),
            ).map((item) => (
              <Chip
                key={`sticky-model-${item}`}
                active={
                  current.model.toLocaleLowerCase("pt-BR") ===
                  item.toLocaleLowerCase("pt-BR")
                }
                onClick={() =>
                  update({
                    model:
                      current.model.toLocaleLowerCase("pt-BR") ===
                      item.toLocaleLowerCase("pt-BR")
                        ? ""
                        : item,
                  })
                }
              >
                {formatModelName(item)}
              </Chip>
            ))}
          </MobileChipRow>
        ) : null}
        {gearOptions.length > 0 ? (
          <MobileChipRow label="Câmbio">
            {gearOptions.map((item) => (
              <Chip
                key={`sticky-gear-${item.value}`}
                active={gearValue === item.value}
                onClick={() =>
                  update({
                    transmission: gearValue === item.value ? "" : item.value,
                  })
                }
              >
                {item.label}
              </Chip>
            ))}
          </MobileChipRow>
        ) : null}
        <div className="mt-2 grid grid-cols-1 items-center gap-2 min-[360px]:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative min-w-0">
            <label htmlFor="estoque-ordem-mobile" className="sr-only">
              Ordenar resultados
            </label>
            <select
              id="estoque-ordem-mobile"
              value={current.sort}
              onChange={(event) => update({ sort: event.target.value })}
              className="min-h-11 w-full appearance-none rounded-none border border-white/15 bg-asphalt py-2 pl-2.5 pr-7 text-base text-cream outline-none transition focus:border-brand"
            >
              {STOCK_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraft(current);
              setOpen(true);
            }}
            ref={filterButtonRef}
            className="stock-chip-action"
            aria-expanded={open}
            aria-controls="painel-filtros"
            aria-label={
              activeFilterCount > 0
                ? `Abrir filtros, ${activeFilterCount} ativos`
                : "Abrir filtros"
            }
          >
            <FilterIcon />
            Filtros
            {activeFilterCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>
        {activeFilters.length > 0 ? (
          <section
            aria-label="Filtros ativos"
            data-stock-active-filters=""
            className="mt-1 border-t border-white/10 pt-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="text-xs font-medium text-cream">
                Sua busca{" "}
                <span className="text-muted">
                  · {activeFilterCount} {activeFilterCount === 1 ? "filtro" : "filtros"}
                </span>
              </p>
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                <ShareSearchButton className="px-2" />
                <button
                  type="button"
                  onClick={clearFilters}
                  className="min-h-11 px-2 text-xs text-muted underline decoration-white/30 underline-offset-4 transition hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
            <ActiveFilterChips filters={activeFilters} onRemove={removeFilter} />
          </section>
        ) : hasFilter ? (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 self-end px-2 text-xs text-muted underline underline-offset-4"
          >
            Limpar filtros
          </button>
        ) : null}
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
            id="painel-filtros"
            aria-labelledby="titulo-filtros"
            className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden border-t border-white/10 bg-ink animate-slide-up focus:outline-none"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-ink px-4 py-3 sm:px-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-brand">Estoque</p>
                <h2 id="titulo-filtros" className="font-display text-lg font-semibold text-cream">
                  Filtrar veículos
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center gap-1.5 border border-white/15 px-3 font-display text-xs font-semibold uppercase tracking-wide text-cream"
              >
                <IconClose className="h-4 w-4" />
                Fechar
              </button>
            </div>

            {FilterFields ? (
              <FilterFields facets={facets} draft={draft} setDraft={setDraft}
                onApply={() => { setOpen(false); navigate(draft); }} />
            ) : (
              <div className="px-4 py-8 sm:px-5" aria-live="polite">
                <p className="text-sm text-cream">{fieldsFailed ? "Não conseguimos abrir os filtros agora." : "Carregando filtros…"}</p>
                {fieldsFailed ? <button type="button" onClick={() => setFieldsAttempt(value => value + 1)}
                  className="mt-4 min-h-11 border border-white/25 px-4 text-sm text-cream">Tentar novamente</button> : null}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

function ActiveFilterChips({
  filters,
  onRemove,
}: {
  filters: ActiveFilter[];
  onRemove: (filter: ActiveFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 lg:mt-3">
      {filters.map((filter) => (
        <button
          key={filter.accessory ? `accessory:${filter.accessory}` : filter.key}
          type="button"
          onClick={() => onRemove(filter)}
          className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md border border-brand/40 bg-brand/10 px-3 py-2 text-left text-xs leading-relaxed text-cream transition hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand lg:rounded-none lg:px-2.5 lg:py-1.5 lg:text-[11px] lg:leading-tight"
          aria-label={`Remover ${filter.label}`}
        >
          <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">{filter.label}</span>
          <IconClose className="h-3.5 w-3.5 shrink-0 text-brand" />
        </button>
      ))}
    </div>
  );
}

function visibleBrandChips(brands: string[], selected: string) {
  if (!selected) return brands.slice(0, 8);
  const rest = brands.filter((item) => item !== selected);
  return [selected, ...rest].slice(0, 8);
}

function MobileChipRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const fit = () => {
      const view = track.getBoundingClientRect();
      const chips = [...track.querySelectorAll<HTMLButtonElement>("button")];
      const { insetLeft, insetRight, hidden } = chipTrackInsets(
        { left: view.left, right: view.right },
        chips.map((chip) => {
          const box = chip.getBoundingClientRect();
          return { left: box.left, right: box.right };
        }),
      );
      track.style.clipPath =
        insetLeft > 0 || insetRight > 0
          ? `inset(0px ${Math.ceil(insetRight)}px 0px ${Math.ceil(insetLeft)}px)`
          : "";
      chips.forEach((chip, index) => {
        if (hidden[index]) {
          chip.setAttribute("aria-hidden", "true");
          chip.tabIndex = -1;
        } else {
          chip.removeAttribute("aria-hidden");
          chip.removeAttribute("tabindex");
        }
      });
    };

    let cancelled = false;
    const apply = () => {
      if (!cancelled) fit();
    };

    apply();
    const resize = new ResizeObserver(apply);
    resize.observe(track);
    const mutations = new MutationObserver(apply);
    mutations.observe(track, { childList: true });
    track.addEventListener("scroll", apply, { passive: true });
    window.addEventListener("resize", apply);
    void document.fonts?.ready.then(apply);

    return () => {
      cancelled = true;
      resize.disconnect();
      mutations.disconnect();
      track.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);

  return (
    <div className="stock-chip-row">
      <p className="stock-chip-label">{label}</p>
      <div ref={trackRef} className="stock-chip-track scrollbar-hide">
        {children}
      </div>
    </div>
  );
}

type FilterChoice = string | { value: string; label: string };

function asFilterChoice(option: FilterChoice) {
  return typeof option === "string" ? { value: option, label: option } : option;
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
  options: readonly FilterChoice[];
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
        {options.map((option) => {
          const item = asFilterChoice(option);
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
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
  children: ReactNode;
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
