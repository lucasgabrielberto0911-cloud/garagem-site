import { accessoryGroup } from "./legend-parser";
import { brandKey, formatBrandName, formatModelName } from "./format";
import { canonicalStockAccessoryLabel } from "./vehicle-accessories";
import { formatColorLabel } from "./vehicle-display";
import type { StockModelOption } from "./stock-query";

export type StockFacets = {
  categories: string[];
  brands: string[];
  models: StockModelOption[];
  transmissions: string[];
  fuels: string[];
  colors: string[];
  accessories: string[];
  years: number[];
};

type FacetRow = {
  category: string; brand: string; model: string; transmission: string;
  fuel: string; color: string | null; yearModel: number; accessories: string[];
};

/** Filtros públicos derivados de uma única projeção do estoque disponível. */
export function buildStockFacets(rows: FacetRow[]): StockFacets {
  const brandsByKey = new Map<string, string>();
  for (const row of rows) {
    const raw = row.brand?.trim();
    if (!raw) continue;
    const key = brandKey(raw);
    if (!brandsByKey.has(key)) {
      brandsByKey.set(key, formatBrandName(raw));
    }
  }

  const unique = (values: string[]) =>
    Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );

  const accessoryByKey = new Map<string, string>();
  for (const row of rows) {
    for (const item of row.accessories) {
      const raw = item?.trim();
      if (!raw || accessoryGroup(raw).group === "Facilidades") continue;
      const canonical = canonicalStockAccessoryLabel(raw);
      if (!canonical) continue;
      const key = canonical.toLocaleLowerCase("pt-BR");
      if (!accessoryByKey.has(key)) accessoryByKey.set(key, canonical);
    }
  }

  const modelsByKey = new Map<string, StockModelOption>();
  const categoriesByModelKey = new Map<string, Set<string>>();
  for (const row of rows) {
    const brand = formatBrandName(row.brand ?? "");
    const model = formatModelName(row.model ?? "");
    if (!brand || !model) continue;
    const key = `${brandKey(brand)}|${brandKey(model)}`;
    if (!categoriesByModelKey.has(key)) {
      categoriesByModelKey.set(key, new Set());
    }
    if (row.category) {
      categoriesByModelKey.get(key)!.add(row.category);
    }
    if (!modelsByKey.has(key)) {
      modelsByKey.set(key, { brand, model });
    }
  }

  for (const [key, item] of modelsByKey) {
    item.categories = Array.from(categoriesByModelKey.get(key) ?? []);
  }

  return {
    categories: unique(rows.map((row) => row.category)),
    brands: Array.from(brandsByKey.values()).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    ),
    models: Array.from(modelsByKey.values()).sort((a, b) => {
      const byBrand = a.brand.localeCompare(b.brand, "pt-BR");
      return byBrand !== 0 ? byBrand : a.model.localeCompare(b.model, "pt-BR");
    }),
    transmissions: unique(rows.map((row) => row.transmission)),
    fuels: unique(rows.map((row) => row.fuel)),
    colors: unique(
      rows
        .map((row) => formatColorLabel(row.color))
        .filter(Boolean),
    ),
    accessories: Array.from(accessoryByKey.values()).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    ),
    years: Array.from(new Set(rows.map((row) => row.yearModel))).sort((a, b) => b - a),
  };
}
