import { STOCK_FILTER_KEYS } from "./stock-query";

/** Só a busca pública e seus filtros, sempre no domínio oficial. */
export function stockShareUrl(origin: string, search: string) {
  const url = new URL("/estoque", origin);
  const params = new URLSearchParams(search);
  for (const key of [...STOCK_FILTER_KEYS, "sort"] as const) {
    const value = params.get(key);
    if (value) url.searchParams.set(key, value);
  }
  return url.href;
}
