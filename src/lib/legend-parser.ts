import { normalizeAccessories, sanitizeAccessory } from "./vehicle-accessories";

export const LEGEND_GROUPS = ["Conforto", "Segurança", "Facilidades", "Outros opcionais"] as const;
export type LegendGroup = typeof LEGEND_GROUPS[number];
export const LEGEND_FIELDS = {
  km: "Quilometragem", year: "Ano de fabricação", yearModel: "Ano modelo",
  color: "Cor", transmission: "Câmbio", fuel: "Combustível", engine: "Motor", price: "Preço",
} as const;
export type LegendField = keyof typeof LEGEND_FIELDS;
export type LegendData = Partial<Record<LegendField, string>>;
export type LegendParseResult = { description: string; accessories: string[]; data: LegendData; sensitive: string[] };

/**
 * Dados que nunca podem ir para o anúncio nem para a IA: placa, chassi,
 * RENAVAM, CPF e telefone. A legenda colada pode trazer esses dados no meio
 * do texto — eles são descartados antes de gravar em qualquer campo público.
 */
const SENSITIVE_LINE_WORD = /\b(placa|chassi|renavam|cpf|cnh|rg|telefone|whatsapp|zap)\b/i;
const SENSITIVE_PLATE = /\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b|\b[A-Z]{3}-\d{4}\b/i;
const SENSITIVE_VIN = /\b[A-HJ-NPR-Z0-9]{17}\b/i;
const SENSITIVE_CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/;
const SENSITIVE_PHONE = /\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/;

function sensitiveLabel(word: string): string {
  const key = fold(word);
  if (key === "whatsapp" || key === "zap" || key === "telefone") return "telefone";
  if (key === "cpf") return "CPF";
  if (key === "renavam") return "RENAVAM";
  if (key === "chassi") return "chassi";
  if (key === "placa") return "placa";
  return word.toUpperCase();
}

/** Remove linhas com dados pessoais/identificadores e diz o que foi tirado. */
export function sanitizeLegendText(text: string): { clean: string; found: string[] } {
  const found = new Set<string>();
  const kept: string[] = [];
  for (const raw of text.split(/\r\n|[\r\n]/)) {
    const labeled = raw.match(SENSITIVE_LINE_WORD);
    if (labeled) {
      found.add(sensitiveLabel(labeled[1]));
      continue;
    }
    if (SENSITIVE_PLATE.test(raw)) { found.add("placa"); continue; }
    if (SENSITIVE_VIN.test(raw)) { found.add("chassi"); continue; }
    if (SENSITIVE_CPF.test(raw)) { found.add("CPF"); continue; }
    if (SENSITIVE_PHONE.test(raw)) { found.add("telefone"); continue; }
    kept.push(raw);
  }
  return { clean: kept.join("\n"), found: [...found] };
}
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
  const sanitized = sanitizeLegendText(text);
  const result: LegendParseResult = { description: "", accessories: [], data: {}, sensitive: sanitized.found };
  const description: string[] = [];
  const seen = new Set<string>();
  let group: LegendGroup = "Outros opcionais";
  for (const raw of sanitized.clean.split(/\r\n|[\r\n]/)) {
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
