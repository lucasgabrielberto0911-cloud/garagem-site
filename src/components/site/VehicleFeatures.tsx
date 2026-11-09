"use client";

import { useState } from "react";
import { VehicleAccessoryChips } from "@/components/site/VehicleAccessoryChips";

const INITIAL = 8;

/** Opcionais no celular: os primeiros itens e "Ver todos (N)" que expande no lugar. */
export function VehicleFeatures({ items }: { items: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const collapsible = items.length > INITIAL + 2;
  const shown = collapsible && !open ? items.slice(0, INITIAL) : items;

  return (
    <div>
      <VehicleAccessoryChips items={shown} />
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center border border-white/20 px-4 font-display text-sm font-semibold text-cream transition touch-manipulation hover:border-brand"
        >
          {open ? "Mostrar menos" : `Ver todos os ${items.length} opcionais`}
        </button>
      ) : null}
    </div>
  );
}
