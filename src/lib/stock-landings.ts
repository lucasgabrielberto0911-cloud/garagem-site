import { formatBrandName, formatModelName } from "./format";

export function stockLandingSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export function stockLandingLinks(rows: { brand: string; model: string }[]) {
  const links = new Map<string, { path: string; label: string }>();
  for (const row of rows) {
    const brand = formatBrandName(row.brand.trim());
    const model = formatModelName(row.model.trim());
    if (!brand || !model) continue;
    for (const [kind, label] of [["marca", brand], ["modelo", `${brand} ${model}`]]) {
      const path = `/${kind}/${stockLandingSlug(label)}`;
      links.set(path, { path, label });
    }
  }
  return [...links.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
