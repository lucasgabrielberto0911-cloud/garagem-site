"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { readStockReturn } from "@/lib/stock-return";

function safeFromParam(raw: string | null) {
  if (
    !raw ||
    !raw.startsWith("/estoque") ||
    raw.startsWith("//") ||
    raw.includes("\\")
  ) {
    return null;
  }
  return raw;
}

/** Volta aos filtros do estoque (query antiga `?from=` ou sessionStorage). */
export function StockBackLink({
  fallbackHref,
  variant = "text",
}: {
  fallbackHref?: string;
  variant?: "text" | "overlay";
} = {}) {
  const params = useSearchParams();
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    setHref(safeFromParam(params.get("from")) ?? readStockReturn());
  }, [params]);

  const target = href ?? fallbackHref ?? null;
  if (!target) return null;

  if (variant === "overlay") {
    return (
      <Link
        href={target}
        prefetch={false}
        scroll={href ? false : undefined}
        aria-label={href ? "Voltar aos resultados" : "Voltar ao estoque"}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/25 bg-asphalt/85 px-3.5 font-display text-sm font-semibold text-cream shadow-md backdrop-blur-sm transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span aria-hidden="true">←</span>
        <span>{href ? "Voltar" : "Estoque"}</span>
      </Link>
    );
  }

  return (
    <Link
      href={target}
      prefetch={false}
      scroll={href ? false : undefined}
      className="mb-2 inline-flex items-center py-1 text-sm font-medium uppercase tracking-wider text-muted transition hover:text-cream"
    >
      <span className="mr-2 text-brand-light" aria-hidden="true">
        ←
      </span>
      {href ? "Voltar aos resultados" : "Voltar ao estoque"}
    </Link>
  );
}
