import type { Prisma } from "@prisma/client";

type SearchCatalogRow = { brand: string; model: string };
const compact = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const isYear = (value: string) => /^(19|20)\d{2}$/.test(value);

/** Expande apenas grafias equivalentes dos modelos que existem no estoque. */
export function stockSearchWhere(query: string, catalog: readonly SearchCatalogRow[]): Prisma.VehicleWhereInput[] {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const clauses: Prisma.VehicleWhereInput[] = [];
  for (let index = 0; index < tokens.length;) {
    const token = tokens[index];
    if (isYear(token)) {
      const year = Number(token);
      clauses.push({ OR: [{ year }, { yearModel: year }] });
      index++;
      continue;
    }
    let count = 1;
    // "HR V" e "CG 160 Start" podem estar guardados com outra separação.
    for (let size = Math.min(3, tokens.length - index); size > 1; size--) {
      const parts = tokens.slice(index, index + size);
      if (parts.some(isYear)) continue;
      const folded = compact(parts.join(" "));
      if (folded.length >= 2 && catalog.some(row => compact(row.model).includes(folded))) {
        count = size;
        break;
      }
    }
    const term = tokens.slice(index, index + count).join(" ");
    const folded = compact(term);
    const models = folded.length >= 2 ? [...new Set(catalog.filter(row => compact(row.model).includes(folded)).map(row => row.model))] : [];
    const brands = folded.length >= 2 ? [...new Set(catalog.filter(row => compact(row.brand).includes(folded)).map(row => row.brand))] : [];
    clauses.push({ OR: [
      { brand: { contains: term, mode: "insensitive" } },
      { model: { contains: term, mode: "insensitive" } },
      { version: { contains: term, mode: "insensitive" } },
      ...(models.length ? [{ model: { in: models, mode: "insensitive" as const } }] : []),
      ...(brands.length ? [{ brand: { in: brands, mode: "insensitive" as const } }] : []),
    ] });
    index += count;
  }
  return clauses;
}
