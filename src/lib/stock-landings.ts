import { formatBrandName, formatModelName } from "./format";

export function stockLandingSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Redireciona slugs com letras maiúsculas para o caminho canônico em minúsculas (ex: /marca/Honda -> /marca/honda). */
export function canonicalSlugRedirect(prefix: string, slug: string): string | null {
  if (!slug || slug === slug.toLowerCase()) return null;
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
  return `/${cleanPrefix}/${slug.toLowerCase()}`;
}
export function stockLandingLinks(
  rows: { brand: string; model: string; updatedAt?: Date | string | null }[],
) {
  const links = new Map<string, { path: string; label: string; lastModified?: Date }>();
  for (const row of rows) {
    const brand = formatBrandName(row.brand.trim());
    const model = formatModelName(row.model.trim());
    if (!brand || !model) continue;
    const parsedDate = row.updatedAt ? new Date(row.updatedAt) : undefined;
    const validDate =
      parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined;
    for (const [kind, label] of [
      ["marca", brand],
      ["modelo", `${brand} ${model}`],
    ] as const) {
      const path = `/${kind}/${stockLandingSlug(label)}`;
      const existing = links.get(path);
      const latest =
        validDate && (!existing?.lastModified || validDate > existing.lastModified)
          ? validDate
          : existing?.lastModified;
      links.set(path, latest ? { path, label, lastModified: latest } : { path, label });
    }
  }
  return [...links.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** Texto baseado no estoque real, sem características ou promessas inventadas. */
export function stockLandingCopy(kind: "marca" | "modelo", label: string, rows: { model: string; yearModel: number; status: string }[]) {
  const available = rows.filter(row => row.status === "disponivel");
  const sold = rows.filter(row => row.status === "vendido");
  const models = [...new Set(available.map(row => formatModelName(row.model)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const years = [...new Set(available.map(row => row.yearModel))].sort((a, b) => a - b);
  const stock = available.length
    ? `${available.length} ${available.length === 1 ? "veículo disponível" : "veículos disponíveis"} de ${label} na Garagem.`
    : `Sem ${label} disponível no momento. Registre o que procura para a loja entrar em contato.`;
  const detail = available.length
    ? kind === "marca"
      ? `Modelos no estoque: ${models.join(", ")}. Confira ano, km e condições na ficha de cada veículo.`
      : `Anos no estoque: ${years.join(", ")}. Compare versão, km e câmbio nas fichas disponíveis.`
    : sold.length
      ? `O histórico de ${label} abaixo reúne veículos já vendidos, sem preço de oferta.`
      : "Consulte outras opções no estoque.";
  return { description: stock, introduction: `${stock} ${detail}` };
}
