"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { readStockReturn } from "@/components/site/StockVehicleLink";

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
export function StockBackLink() {
  const params = useSearchParams();
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    setHref(safeFromParam(params.get("from")) ?? readStockReturn());
  }, [params]);

  if (!href) return null;

  return (
    <Link
      href={href}
      className="mb-3 inline-flex min-h-[44px] items-center text-xs font-medium uppercase tracking-wider text-muted transition hover:text-cream"
    >
      <span className="mr-2 text-brand" aria-hidden="true">
        ←
      </span>
      Voltar aos resultados
    </Link>
  );
}
