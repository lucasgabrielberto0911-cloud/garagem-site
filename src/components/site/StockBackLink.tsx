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
        aria-label={href ? "Voltar aos resultados" : "Voltar ao estoque"}
        className="inline-flex h-10 w-10 items-center justify-center border border-white/15 bg-asphalt text-lg leading-none text-cream"
      >
        <span aria-hidden="true">←</span>
      </Link>
    );
  }

  return (
    <Link
      href={target}
      className="mb-3 inline-flex min-h-[44px] items-center text-xs font-medium uppercase tracking-wider text-muted transition hover:text-cream"
    >
      <span className="mr-2 text-brand" aria-hidden="true">
        ←
      </span>
      {href ? "Voltar aos resultados" : "Voltar ao estoque"}
    </Link>
  );
}
