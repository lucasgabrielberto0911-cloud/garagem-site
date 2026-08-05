"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IconSearch } from "@/components/site/icons";

export function HeroSearch({ brands = [] }: { brands?: string[] }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(query: string) {
    const trimmed = query.trim();
    const search = trimmed ? `?q=${encodeURIComponent(trimmed)}` : "";
    startTransition(() => {
      router.push(`/estoque${search}`);
    });
  }

  return (
    <div className="w-full max-w-xl">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(term);
        }}
        className="flex flex-col gap-2 border border-white/15 bg-asphalt/80 p-2 backdrop-blur sm:flex-row"
        role="search"
      >
        <label htmlFor="hero-busca" className="sr-only">
          Buscar por marca ou modelo
        </label>
        <div className="flex flex-1 items-center gap-2 px-3">
          <IconSearch className="h-4 w-4 shrink-0 text-muted" />
          <input
            id="hero-busca"
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Busque por marca ou modelo"
            className="w-full bg-transparent py-2.5 text-sm text-cream placeholder:text-muted focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand px-6 py-3 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] disabled:opacity-70"
        >
          {isPending ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {brands.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted">
            Marcas no estoque:
          </span>
          {brands.slice(0, 5).map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => submit(brand)}
              className="border border-white/15 px-2.5 py-1 text-xs text-cream transition hover:border-brand hover:bg-white/5"
            >
              {brand}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
