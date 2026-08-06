"use client";

import { useMemo, useState } from "react";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import {
  FAQ_CATEGORIES,
  type FaqCategory,
  type FaqItem,
} from "@/lib/faq";
import { IconSearch } from "@/components/site/icons";

export function FaqExplorer({ items }: { items: FaqItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FaqCategory | "todas">("todas");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "todas" && item.category !== category) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q)
      );
    });
  }, [items, query, category]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Buscar dúvidas</span>
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por palavra-chave…"
            className="w-full min-h-[48px] border border-white/10 bg-ink py-2.5 pl-10 pr-3 text-sm text-cream outline-none transition placeholder:text-muted focus:border-brand"
          />
        </label>
      </div>

      <div
        role="tablist"
        aria-label="Categorias"
        className="mt-4 flex flex-wrap justify-center gap-2"
      >
        {FAQ_CATEGORIES.map((cat) => {
          const active = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(cat.id)}
              className={`inline-flex min-h-[40px] shrink-0 items-center border px-3 font-display text-xs font-semibold uppercase tracking-wider transition touch-manipulation ${
                active
                  ? "border-brand bg-brand/15 text-cream"
                  : "border-white/10 text-muted hover:border-brand/50 hover:text-cream"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-center text-xs uppercase tracking-wider text-muted lg:text-left">
        {filtered.length}{" "}
        {filtered.length === 1 ? "dúvida encontrada" : "dúvidas encontradas"}
      </p>

      <div className="mt-4">
        {filtered.length === 0 ? (
          <div className="border border-dashed border-white/15 bg-ink/40 px-6 py-10 text-center">
            <p className="font-display text-base font-semibold text-cream">
              Nenhuma dúvida com esse filtro
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Tente outra palavra ou categoria — ou chame no WhatsApp.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("todas");
              }}
              className="mt-4 inline-flex min-h-[44px] items-center border border-white/15 px-4 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:border-brand"
            >
              Limpar busca
            </button>
          </div>
        ) : (
          <FaqAccordion items={filtered} />
        )}
      </div>
    </div>
  );
}
