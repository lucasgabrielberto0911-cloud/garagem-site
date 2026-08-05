"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { IconSearch } from "@/components/site/icons";

export type Facets = {
  brands: string[];
  transmissions: string[];
  fuels: string[];
};

const SORT_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "menor-km", label: "Menor KM" },
  { value: "mais-novo", label: "Ano mais novo" },
] as const;

const selectClass =
  "w-full border border-white/10 bg-asphalt px-3 py-2.5 text-sm text-cream outline-none transition focus:border-brand";

export function StockFilters({ facets }: { facets: Facets }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const current = {
    q: params.get("q") ?? "",
    brand: params.get("brand") ?? "",
    transmission: params.get("transmission") ?? "",
    fuel: params.get("fuel") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    sort: params.get("sort") ?? "recentes",
  };

  const hasFilter = Object.entries(current).some(
    ([key, value]) => value && !(key === "sort" && value === "recentes"),
  );

  function update(patch: Partial<typeof current>) {
    const next = new URLSearchParams();
    const merged = { ...current, ...patch };
    Object.entries(merged).forEach(([key, value]) => {
      if (value && !(key === "sort" && value === "recentes")) {
        next.set(key, String(value));
      }
    });
    const query = next.toString();
    startTransition(() => {
      router.push(query ? `/estoque?${query}` : "/estoque");
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const value = (
          event.currentTarget.elements.namedItem("q") as HTMLInputElement
        ).value;
        update({ q: value });
      }}
      className="border border-white/10 bg-ink p-4 sm:p-5"
      role="search"
    >
      <div className="grid gap-3 lg:grid-cols-[1.6fr_repeat(3,1fr)]">
        <div className="flex items-center gap-2 border border-white/10 bg-asphalt px-3">
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
            className="w-full bg-transparent py-2.5 text-sm text-cream placeholder:text-muted focus:outline-none"
          />
        </div>

        <select
          aria-label="Marca"
          value={current.brand}
          onChange={(event) => update({ brand: event.target.value })}
          className={selectClass}
        >
          <option value="">Todas as marcas</option>
          {facets.brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>

        <select
          aria-label="Câmbio"
          value={current.transmission}
          onChange={(event) => update({ transmission: event.target.value })}
          className={selectClass}
        >
          <option value="">Todos os câmbios</option>
          {facets.transmissions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          aria-label="Combustível"
          value={current.fuel}
          onChange={(event) => update({ fuel: event.target.value })}
          className={selectClass}
        >
          <option value="">Todos os combustíveis</option>
          {facets.fuels.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand px-5 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] disabled:opacity-70"
        >
          {isPending ? "Filtrando..." : "Buscar"}
        </button>

        <div className="flex items-center gap-2">
          <label
            htmlFor="estoque-ordem"
            className="text-xs uppercase tracking-wider text-muted"
          >
            Ordenar
          </label>
          <select
            id="estoque-ordem"
            value={current.sort}
            onChange={(event) => update({ sort: event.target.value })}
            className="border border-white/10 bg-asphalt px-3 py-2 text-sm text-cream outline-none transition focus:border-brand"
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
            onClick={() =>
              startTransition(() => {
                router.push("/estoque");
              })
            }
            className="text-xs uppercase tracking-wider text-muted underline-offset-4 transition hover:text-cream hover:underline"
          >
            Limpar filtros
          </button>
        ) : null}
      </div>
    </form>
  );
}
