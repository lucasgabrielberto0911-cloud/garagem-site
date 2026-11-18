"use client";

import { useState, type ReactNode } from "react";

/** Opcionais no celular: os primeiros itens e "Ver todos (N)" que expande no lugar. */
export function VehicleFeatures({
  total,
  preview,
  full,
}: {
  total: number;
  preview: ReactNode;
  full: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {open ? full : preview}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center border border-white/20 px-4 font-display text-sm font-semibold text-cream transition touch-manipulation hover:border-brand"
      >
        {open ? "Mostrar menos" : `Ver todos os ${total} opcionais`}
      </button>
    </div>
  );
}
