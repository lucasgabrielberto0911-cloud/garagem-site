"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { STOCK_FILTER_KEYS } from "@/lib/stock-query";

/** Some com filtro ativo. No HTML de /estoque, sem query, a lista fica. */
export function StockCatalogGate({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const filtered = STOCK_FILTER_KEYS.some((key) => Boolean(params.get(key)));
  if (filtered) return null;
  return children;
}
