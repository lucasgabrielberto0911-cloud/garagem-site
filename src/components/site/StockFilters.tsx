"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { IconClose, IconSearch } from "@/components/site/icons";

export type Facets = {
  brands: string[];
  transmissions: string[];
  fuels: string[];
  years: number[];
};

const SORT_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "menor-km", label: "Menor KM" },
  { value: "mais-novo", label: "Ano mais novo" },
] as const;

const selectClass =
  "w-full min-h-[48px] border border-white/10 bg-asphalt px-3 py-2.5 text-sm text-cream outline-none transition focus:border-brand";

const PRICE_OPTIONS = [
  { value: "", label: "Qualquer preço" },
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
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const current = {
    q: params.get("q") ?? "",
    brand: params.get("brand") ?? "",
    transmission: params.get("transmission") ?? "",
    fuel: params.get("fuel") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    minYear: params.get("minYear") ?? "",
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
    setDraft(current);
    // URL params are the source of truth after navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const hasFilter = Object.entries(current).some(
    ([key, value]) => value && !(key === "sort" && value === "recentes"),
  );
  const activeFilterCount = [
    current.brand,
    current.transmission,
    current.fuel,
    current.maxPrice,
    current.minYear,
    current.maxKm,
  ].filter(Boolean).length;

  function navigate(values: typeof current) {
    const next = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value && !(key === "sort" && value === "recentes")) {
        next.set(key, String(value));
      }
    });
    const query = next.toString();
    startTransition(() => {
      router.push(query ? `/estoque?${query}` : "/estoque");
    });
  }

  function update(patch: Partial<typeof current>) {
    navigate({ ...current, ...patch });
  }

  function clearFilters() {
    setOpen(false);
    navigate({
      q: "",
      brand: "",
      transmission: "",
      fuel: "",
      maxPrice: "",
      minYear: "",
      maxKm: "",
      sort: "recentes",
    });
  }

  return (
    <>
      <div className="border border-white/10 bg-ink p-3 sm:p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = (
              event.currentTarget.elements.namedItem("q") as HTMLInputElement
            ).value;
            update({ q: value });
          }}
          className="mx-auto flex max-w-2xl gap-2"
          role="search"
        >
          <div className="flex min-h-[48px] flex-1 items-center gap-2 border border-white/10 bg-asphalt px-3 transition focus-within:border-brand">
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
              className="w-full bg-transparent py-3 text-sm text-cream placeholder:text-muted focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="min-h-[48px] bg-brand px-4 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] disabled:opacity-70 sm:px-6"
          >
            <span className="hidden sm:inline">{isPending ? "Buscando..." : "Buscar"}</span>
            <IconSearch className="h-5 w-5 sm:hidden" />
          </button>
        </form>

        {/* Desktop: filtros completos. */}
        <div className="mx-auto mt-3 hidden max-w-4xl grid-cols-3 gap-3 lg:grid">
          <FilterSelect
            label="Marca"
            value={current.brand}
            onChange={(value) => update({ brand: value })}
            options={facets.brands}
            emptyLabel="Todas as marcas"
          />
          <FilterSelect
            label="Câmbio"
            value={current.transmission}
            onChange={(value) => update({ transmission: value })}
            options={facets.transmissions}
            emptyLabel="Todos os câmbios"
          />
          <FilterSelect
            label="Combustível"
            value={current.fuel}
            onChange={(value) => update({ fuel: value })}
            options={facets.fuels}
            emptyLabel="Todos os combustíveis"
          />
          <label className="sr-only" htmlFor="desktop-preco">
            Preço máximo
          </label>
          <select
            id="desktop-preco"
            value={current.maxPrice}
            onChange={(event) => update({ maxPrice: event.target.value })}
            className={selectClass}
          >
            {PRICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="desktop-ano">
            Ano a partir de
          </label>
          <select
            id="desktop-ano"
            value={current.minYear}
            onChange={(event) => update({ minYear: event.target.value })}
            className={selectClass}
          >
            <option value="">Qualquer ano</option>
            {facets.years.map((year) => (
              <option key={year} value={year}>
                A partir de {year}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="desktop-km">
            Quilometragem máxima
          </label>
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
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setDraft(current);
              setOpen(true);
            }}
            className="relative inline-flex min-h-[44px] items-center gap-2 border border-white/15 px-4 font-display text-xs font-semibold uppercase tracking-wide text-cream lg:hidden"
          >
            <FilterIcon />
            Filtros
            {activeFilterCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>

          <div className="hidden items-center gap-2 lg:flex">
            <label htmlFor="estoque-ordem" className="text-xs uppercase tracking-wider text-muted">
              Ordenar
            </label>
            <select
              id="estoque-ordem"
              value={current.sort}
              onChange={(event) => update({ sort: event.target.value })}
              className="min-h-[44px] border border-white/10 bg-asphalt px-3 text-sm text-cream outline-none transition focus:border-brand"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

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

        {/* Mobile/tablet: ordenação por chips centralizados. */}
        <div className="mt-3 lg:hidden">
          <div className="flex flex-wrap justify-center gap-2">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update({ sort: option.value })}
                className={`min-h-[38px] whitespace-nowrap border px-3 text-xs font-medium transition ${
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-filtros"
            className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto border-t border-white/10 bg-ink animate-slide-up pb-safe"
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
              <MobileField label="Preço máximo">
                <select
                  value={draft.maxPrice}
                  onChange={(event) => setDraft({ ...draft, maxPrice: event.target.value })}
                  className={selectClass}
                >
                  {PRICE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </MobileField>
              <MobileField label="Ano a partir de">
                <select
                  value={draft.minYear}
                  onChange={(event) => setDraft({ ...draft, minYear: event.target.value })}
                  className={selectClass}
                >
                  <option value="">Qualquer ano</option>
                  {facets.years.map((year) => (
                    <option key={year} value={year}>{year}</option>
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

            <div className="sticky bottom-0 grid grid-cols-[auto_1fr] gap-3 border-t border-white/10 bg-ink/95 px-5 py-4 backdrop-blur">
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    brand: "",
                    transmission: "",
                    fuel: "",
                    maxPrice: "",
                    minYear: "",
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
                Aplicar filtros
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  emptyLabel: string;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass}
      >
        <option value="">{emptyLabel}</option>
        {options.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>
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

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  );
}
