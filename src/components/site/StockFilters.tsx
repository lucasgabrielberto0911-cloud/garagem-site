"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { BUDGET_CHIPS, MIN_PRICE_OPTIONS, MAX_PRICE_OPTIONS, KM_OPTIONS, selectClass, selectedOption, toggleAccessoryValue, splitAccessories, AccessoryChips, Chip, formatCompactNumber } from "./StockFilterControls";
import { IconClose, IconSearch, IconShare } from "@/components/site/icons";
import { useStockPendingOptional } from "@/components/site/StockPending";
import { formatBrandName, formatModelName } from "@/lib/format";
import {
  modelAfterBrandChange,
  modelFilterOptions,
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
  const shortcutsLabelId = useId();
  const desktopAccessoryLabelId = useId();
  const activeFiltersLabelId = useId();

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
    sort: params.get("sort") ?? "destaques",
  };
  const [draft, setDraft] = useState(current);
  const [qText, setQText] = useState(current.q);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<number | undefined>(undefined);
  const currentRef = useRef(current);
  currentRef.current = current;
  const [draftTotal, setDraftTotal] = useState<number | null>(null);
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
    // Mantém o campo igual à URL (ex.: Limpar filtros), sem atropelar quem está digitando.
    if (document.activeElement !== searchRef.current) setQText(params.get("q") ?? "");
    return () => window.clearTimeout(searchTimer.current);
  }, [params]);

  useEffect(() => {
    setDraft(current);
    // URL params are the source of truth after navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const hasFilter = Object.entries(current).some(
    ([key, value]) => value && !(key === "sort" && value === "destaques"),
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
      if (value && !(key === "sort" && value === "destaques")) {
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

  const updateRef = useRef(update);
  updateRef.current = update;

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
      sort: "destaques",
    });
  }

  const gearOptions = transmissionFilterOptions(
    facets.transmissions,
    current.transmission,
  );
  const gearValue = transmissionFilterParam(current.transmission);
  const quickChips = [
    {
      key: "carro",
      label: "Carros",
      active: current.category === "carro",
      onClick: () => update({ category: current.category === "carro" ? "" : "carro" }),
    },
    {
      key: "moto",
      label: "Motos",
      active: current.category === "moto",
      onClick: () => update({ category: current.category === "moto" ? "" : "moto" }),
    },
    {
      key: "automatico",
      label: "Automático",
      active: gearValue === "automatico",
      onClick: () => update({ transmission: gearValue === "automatico" ? "" : "automatico" }),
    },
    ...BUDGET_CHIPS.map((chip) => {
      const active = current.minPrice === chip.minPrice && current.maxPrice === chip.maxPrice;
      return {
        key: `faixa-${chip.label}`,
        label: chip.label,
        active,
        onClick: () =>
          update(active ? { minPrice: "", maxPrice: "" } : { minPrice: chip.minPrice, maxPrice: chip.maxPrice }),
      };
    }),
  ];

  // "Ver X veículos": conta o resultado do rascunho enquanto a gaveta está aberta.
  const draftKey = JSON.stringify({ ...draft, sort: "", transmission: transmissionFilterParam(draft.transmission) });
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams();
      Object.entries(JSON.parse(draftKey) as FilterValues).forEach(([key, value]) => {
        if (value && key !== "sort") query.set(key, String(value));
      });
      query.set("page", "1");
      query.set("pageSize", "1");
      fetch(`/api/estoque?${query.toString()}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data && Number.isFinite(data.total)) setDraftTotal(data.total);
        })
        .catch(() => {});
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, draftKey]);

  return (
    <>
      <div
        aria-busy={isPending}
        data-pending={isPending}
        className={`border-0 bg-transparent p-0 transition-opacity lg:border lg:border-white/10 lg:bg-ink lg:p-5 ${
          isPending ? "opacity-70" : ""
        }`}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (searchTimer.current) window.clearTimeout(searchTimer.current);
            update({ q: qText.trim() });
          }}
          className="mx-auto max-w-2xl"
          role="search"
        >
          <div className="flex min-h-11 items-center gap-2.5 border border-white/10 bg-asphalt px-3.5 transition focus-within:border-brand focus-within:outline focus-within:outline-2 focus-within:outline-offset-[3px] focus-within:outline-brand lg:min-h-[48px]">
            <IconSearch className="h-4 w-4 shrink-0 text-muted" />
            <label htmlFor="estoque-busca" className="sr-only">
              Buscar por marca, modelo ou versão
            </label>
            <input
              id="estoque-busca"
              ref={searchRef}
              name="q"
              type="search"
              enterKeyHint="search"
              value={qText}
              onChange={(event) => {
                const value = event.target.value;
                setQText(value);
                if (searchTimer.current) window.clearTimeout(searchTimer.current);
                searchTimer.current = window.setTimeout(() => {
                  if (value.trim() !== currentRef.current.q) updateRef.current({ q: value.trim() });
                }, 600);
              }}
              placeholder="Marca, modelo ou versão"
              className="w-full min-w-0 bg-transparent py-2 text-base text-cream placeholder:text-muted focus:outline-none lg:text-sm"
            />
          </div>
        </form>

        {/* Desktop: filtros completos, sem rolagem interna. */}
        <div className="mt-5 hidden lg:block">
          <div>
            <p id={shortcutsLabelId} className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
              Atalhos
            </p>
            <div role="group" aria-labelledby={shortcutsLabelId} className="flex flex-wrap gap-2">
              {quickChips.map((chip) => (
                <Chip key={chip.key} active={chip.active} onClick={chip.onClick}>
                  {chip.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
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
              emptyLabel="Todas"
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
              emptyLabel="Todos"
            />
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
                <option value="">Qualquer</option>
                {facets.years.map((year) => (
                  <option key={`min-${year}`} value={year}>
                    {year}
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
                <option value="">Qualquer</option>
                {facets.years.map((year) => (
                  <option key={`max-${year}`} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </DesktopField>
          </div>

          <details
            className="mt-5 border border-white/10 bg-asphalt/30 px-3.5 py-1"
            open={Boolean(
              current.transmission || current.fuel || current.color || current.accessory || current.laudo || current.maxKm,
            )}
          >
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center font-display text-xs font-semibold uppercase tracking-wider text-cream [&::-webkit-details-marker]:hidden">
              Mais filtros
              <span className="ml-auto text-[10px] font-medium normal-case tracking-wide text-muted">
                câmbio, combustível, cor, km
              </span>
            </summary>
            <div className="space-y-4 pb-4 pt-2">
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
              {(facets.accessories ?? []).length > 0 ? (
                <div>
                  <p id={desktopAccessoryLabelId} className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                    Acessórios
                  </p>
                  <AccessoryChips
                    options={facets.accessories ?? []}
                    value={current.accessory}
                    labelledBy={desktopAccessoryLabelId}
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
            </div>
          </details>

          {activeFilters.length > 0 ? (
            <div className="mt-5 border-t border-white/10 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  id={activeFiltersLabelId}
                  className="text-[10px] font-medium uppercase tracking-wider text-muted"
                >
                  Filtros ativos
                </p>
                <ShareSearchButton />
              </div>
              <div role="group" aria-labelledby={activeFiltersLabelId}>
                <ActiveFilterChips filters={activeFilters} onRemove={removeFilter} />
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

      </div>

      <div
        data-stock-filters=""
        className="stock-chip-bar mt-2 border border-white/10 bg-ink px-2.5 py-2 lg:hidden"
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
          <MobileChipRow label="Atalhos">
            {quickChips.map((chip) => (
              <Chip key={`sticky-${chip.key}`} active={chip.active} onClick={chip.onClick}>
                {chip.label}
              </Chip>
            ))}
          </MobileChipRow>
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
            aria-hidden="true"
            tabIndex={-1}
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
                <p className="text-[10px] uppercase tracking-[0.2em] text-brand-light">Estoque</p>
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
              <FilterFields facets={facets} draft={draft} setDraft={setDraft} resultCount={draftTotal}
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
          <IconClose className="h-3.5 w-3.5 shrink-0 text-brand-light" />
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
  const labelId = useId();

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
      <p id={labelId} className="stock-chip-label">{label}</p>
      <div ref={trackRef} role="group" aria-labelledby={labelId} className="stock-chip-track scrollbar-hide">
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
