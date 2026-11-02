import { normalizeAccessories, sanitizeAccessory } from "./vehicle-accessories";

export const LEGEND_GROUPS = ["Conforto", "Segurança", "Facilidades", "Outros opcionais"] as const;
export type LegendGroup = typeof LEGEND_GROUPS[number];
export const LEGEND_FIELDS = {
  km: "Quilometragem", year: "Ano de fabricação", yearModel: "Ano modelo",
  color: "Cor", transmission: "Câmbio", fuel: "Combustível", engine: "Motor", price: "Preço",
} as const;
export type LegendField = keyof typeof LEGEND_FIELDS;
export type LegendData = Partial<Record<LegendField, string>>;
export type LegendParseResult = { description: string; accessories: string[]; data: LegendData };
export const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function accessoryGroup(item: string): { group: LegendGroup; text: string } {
  for (const group of LEGEND_GROUPS) {
    if (item.startsWith(`${group}: `)) return { group, text: item.slice(group.length + 2) };
  }
  return { group: "Outros opcionais", text: item };
}

export function groupAccessories(items: readonly string[]) {
  return LEGEND_GROUPS.map(group => ({ group, items: items.filter(item => accessoryGroup(item).group === group) }))
    .filter(group => group.items.length > 0);
}

/** Recusa qualquer normalização que cortaria itens ou detalhes exibidos na prévia. */
export function legendAccessoriesError(items: string[]) {
  return JSON.stringify(items) !== JSON.stringify(normalizeAccessories(items))
    ? "Há itens acima do limite de 100 caracteres ou mais de 60 itens. Remova ou ajuste a legenda antes de publicar."
    : "";
}

/** Cada linha marcada é um item inteiro, sem gerar também presets da mesma frase. */
export function parseLegend(text: string): LegendParseResult {
  const result: LegendParseResult = { description: "", accessories: [], data: {} };
  const description: string[] = [];
  const seen = new Set<string>();
  let group: LegendGroup = "Outros opcionais";
  for (const raw of text.split(/\r\n|[\r\n]/)) {
    const line = raw.replace(/^[\s\p{P}\p{S}\uFE0F]+/u, "").trim();
    if (!line) continue;
    const key = fold(line);
    if (/^(?:equipamentos(?: e conforto)?|conforto)\s*:?$/.test(key)) { group = "Conforto"; continue; }
    if (/^seguranca\s*:?$/.test(key)) { group = "Segurança"; continue; }
    if (/^facilidades\s*:?$/.test(key)) { group = "Facilidades"; continue; }
    if (/^(?:outros opcionais|opcionais|acessorios)\s*:?$/.test(key)) { group = "Outros opcionais"; continue; }
    if (/^\s*[✅✔☑•*–-]/u.test(raw)) {
      const cleanedLine = sanitizeAccessory(line);
      if (!cleanedLine) continue;
      const itemKey = fold(cleanedLine).replace(/\s+/g, " ");
      if (!seen.has(itemKey)) {
        seen.add(itemKey);
        result.accessories.push(`${group}: ${cleanedLine}`);
      }
      continue;
    }
    const datum = line.match(/^(Quilometragem|Km|Ano de fabricação|Ano modelo|Ano|Cor|Câmbio|Combustível|Motor|Valor|Preço)\s*:\s*(.+)$/i);
    if (datum) {
      const value = datum[2].trim();
      const name = fold(datum[1]);
      if (name === "ano de fabricacao" || name === "ano modelo") result.data[name === "ano modelo" ? "yearModel" : "year"] = value;
      else if (name === "ano") {
        const years = value.match(/^(\d{4})(?:\s*\/\s*(\d{4}))?$/);
        if (years) { result.data.year = years[1]; result.data.yearModel = years[2] ?? years[1]; }
        else description.push(line);
      } else if (name === "km" || name === "quilometragem") result.data.km = value.replace(/\s*km$/i, "");
      else if (name === "valor" || name === "preco") result.data.price = value.replace(/^R\$\s*/, "");
      else {
        const field = ({ cor: "color", cambio: "transmission", combustivel: "fuel", motor: "engine" } as const)[name as "cor" | "cambio" | "combustivel" | "motor"];
        result.data[field] = value;
      }
      continue;
    }
    // Cabeçalho comercial, identificação e convite não são a descrição do veículo.
    if (/^(?:disponivel no estoque|agende sua visita)/.test(key) || /^\s*🚗/u.test(raw)) continue;
    description.push(line);
  }
  result.description = description.join("\n\n");
  return result;
}

export function legendText(description: string, items: string[], data: LegendData = {}) {
  const facts = Object.entries(data).filter(([, value]) => value).map(([field, value]) => `${LEGEND_FIELDS[field as LegendField]}: ${value}`).join("\n");
  return [description, facts, ...groupAccessories(items).map(({ group, items }) =>
    `${group}:\n${items.map(item => `✅ ${accessoryGroup(item).text}`).join("\n")}`)].filter(Boolean).join("\n\n");
}
