"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

const FILTER_KEYS = [
  "q",
  "category",
  "brand",
  "transmission",
  "fuel",
  "color",
  "accessory",
  "laudo",
  "minPrice",
  "maxPrice",
  "minYear",
  "maxYear",
  "maxKm",
] as const;

/** Some com filtro ativo. No HTML de /estoque, sem query, a lista fica. */
export function StockCatalogGate({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const filtered = FILTER_KEYS.some((key) => Boolean(params.get(key)));
  if (filtered) return null;
  return children;
}
