/**
 * Consulta de veículo pela placa (uso exclusivo do admin).
 *
 * Fonte: https://placafipe.com/placa/{PLACA} — página pública com dados do
 * veículo e versões FIPE. Sem token. Se o Cloudflare bloquear o fetch direto,
 * usamos o leitor r.jina.ai como fallback.
 */

import { parseFipePrice } from "@/lib/fipe";
import { normalizePlate } from "@/lib/format";

export const PLACAFIPE_SITE = "https://placafipe.com";

export type PlateFipeVersion = {
  id: string;
  codeFipe: string;
  brand: string;
  model: string;
  modelYear: number | null;
  fuel: string | null;
  price: number | null;
  priceLabel: string | null;
  score: number | null;
  referenceMonth: string | null;
};

export type PlateLookupResult = {
  plate: string;
  brand: string | null;
  model: string | null;
  version: string | null;
  year: number | null;
  yearModel: number | null;
  color: string | null;
  fuel: string | null;
  engine: string | null;
  versions: PlateFipeVersion[];
  sourceUrl: string;
};

function mapFuelHint(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.toLocaleLowerCase("pt-BR");
  if (value.includes("diesel")) return "Diesel";
  if (value.includes("híbrid") || value.includes("hibrid")) return "Híbrido";
  if (value.includes("elétr") || value.includes("eletr")) return "Elétrico";
  if (
    value.includes("álcool") ||
    value.includes("alcool") ||
    value.includes("etanol")
  ) {
    if (value.includes("gasolina") || value.includes("flex")) return "Flex";
    return "Etanol";
  }
  if (
    value.includes("flex") ||
    (value.includes("gasolina") && value.includes("álcool"))
  ) {
    return "Flex";
  }
  if (value.includes("gasolina")) return "Gasolina";
  return null;
}

function pickField(text: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`\\*\\*${escaped}:\\*\\*\\s*([^\\n*]+)`, "i"),
    new RegExp(`${escaped}:\\s*\\|\\s*([^|\\n]+)`, "i"),
    new RegExp(`<t[dh][^>]*>\\s*${escaped}\\s*:?\\s*</t[dh]>\\s*<t[dh][^>]*>\\s*([^<]+)`, "i"),
    new RegExp(`${escaped}:\\s*([^\\n<|]+)`, "i"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = match[1].replace(/\*\*/g, "").replace(/\|/g, "").trim();
      if (value) return value;
    }
  }
  return null;
}

function parseYear(raw: string | null): number | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  const year = Number(digits);
  return year >= 1950 && year <= new Date().getFullYear() + 1 ? year : null;
}

/** Expande abreviações DETRAN comuns para melhorar o match com nomes FIPE. */
function expandModelHints(raw: string): string {
  return raw
    .toLocaleLowerCase("pt-BR")
    .replace(/\bprem\b/g, "premium")
    .replace(/\bcomf\b/g, "comfort")
    .replace(/\bexp\b/g, "expression")
    .replace(/\bltz\b/g, "ltz")
    .replace(/\b(\d)[.,](\d)a\b/g, "$1.$2 aut")
    .replace(/\b(\d)[.,](\d)m\b/g, "$1.$2 mec")
    .replace(/\baut\b/g, "aut")
    .replace(/\bmec\b/g, "mec");
}

function tokenize(value: string): string[] {
  return expandModelHints(value)
    .replace(/[^a-z0-9.]+/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function scoreModelMatch(detranModel: string | null, fipeModel: string): number {
  if (!detranModel) return 0;
  const needle = tokenize(detranModel);
  const hay = new Set(tokenize(fipeModel));
  if (needle.length === 0) return 0;
  let hits = 0;
  for (const token of needle) {
    if (hay.has(token)) {
      hits += 1;
      continue;
    }
    // "1.6" vs "16v" etc.
    if (Array.from(hay).some((item) => item.includes(token) || token.includes(item))) {
      hits += 0.5;
    }
  }
  return Math.round((hits / needle.length) * 100);
}

function parseFipeBlocks(text: string, brand: string | null): PlateFipeVersion[] {
  const versions: PlateFipeVersion[] = [];
  const seen = new Set<string>();

  // Blocos "FIPE: CODE / Modelo: ... / Valor: ..."
  const blockRe =
    /FIPE:\s*([0-9]{5,7}-[0-9])\s*(?:\n|\r|\|)?\s*Modelo:\s*([^\n|]+?)\s*(?:\n|\r|\|)?\s*Valor:\s*(R\$\s*[\d.]+,\d{2})/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(text)) !== null) {
    const codeFipe = match[1].trim();
    const model = match[2].replace(/\*\*/g, "").trim();
    const priceLabel = match[3].replace(/\s+/g, " ").trim();
    if (seen.has(codeFipe)) continue;
    seen.add(codeFipe);
    versions.push({
      id: codeFipe,
      codeFipe,
      brand: brand ?? "",
      model,
      modelYear: null,
      fuel: null,
      price: parseFipePrice(priceLabel),
      priceLabel,
      score: null,
      referenceMonth: null,
    });
  }

  // Tabela markdown "| CODE | Modelo | R$ ... |"
  const rowRe =
    /\|\s*([0-9]{5,7}-[0-9])\s*\|\s*([^|]+?)\s*\|\s*(R\$\s*[\d.]+,\d{2})\s*\|/gi;
  while ((match = rowRe.exec(text)) !== null) {
    const codeFipe = match[1].trim();
    if (seen.has(codeFipe)) continue;
    seen.add(codeFipe);
    const model = match[2].replace(/\*\*/g, "").trim();
    const priceLabel = match[3].replace(/\s+/g, " ").trim();
    versions.push({
      id: codeFipe,
      codeFipe,
      brand: brand ?? "",
      model,
      modelYear: null,
      fuel: null,
      price: parseFipePrice(priceLabel),
      priceLabel,
      score: null,
      referenceMonth: null,
    });
  }

  // Linhas compactas do jina: "015092-4 HB20 Premium ...R$ 56.035,00"
  const compactRe =
    /(?:^|\n)\s*([0-9]{5,7}-[0-9])\s+(.+?)\s*(R\$\s*[\d.]+,\d{2})/g;
  while ((match = compactRe.exec(text)) !== null) {
    const codeFipe = match[1].trim();
    if (seen.has(codeFipe)) continue;
    seen.add(codeFipe);
    const model = match[2].replace(/\*\*/g, "").replace(/\|/g, "").trim();
    const priceLabel = match[3].replace(/\s+/g, " ").trim();
    if (!model || model.length < 3) continue;
    versions.push({
      id: codeFipe,
      codeFipe,
      brand: brand ?? "",
      model,
      modelYear: null,
      fuel: null,
      price: parseFipePrice(priceLabel),
      priceLabel,
      score: null,
      referenceMonth: null,
    });
  }

  return versions;
}

function parseReferenceMonth(text: string): string | null {
  const match = text.match(
    /Tabela FIPE de\s+([A-Za-zçÇáéíóúãõâêôÁÉÍÓÚÃÕÂÊÔ]+\s+\d{4})/i,
  );
  return match?.[1]?.trim() ?? null;
}

function parseLookupText(plate: string, text: string, sourceUrl: string): PlateLookupResult {
  if (
    /placa\s+n[aã]o\s+(encontrada|localizada|reconhecida)/i.test(text) ||
    /n[aã]o\s+foi\s+poss[ií]vel\s+encontrar/i.test(text)
  ) {
    throw new Error("Placa não encontrada no PlacaFipe.");
  }

  const brand = pickField(text, "Marca");
  const model = pickField(text, "Modelo");
  const color = pickField(text, "Cor");
  const fuelRaw = pickField(text, "Combustível") ?? pickField(text, "Combustivel");
  const year = parseYear(pickField(text, "Ano"));
  const yearModel =
    parseYear(pickField(text, "Ano Modelo")) ??
    parseYear(pickField(text, "Ano modelo")) ??
    year;
  const engineCc = pickField(text, "Cilindrada");
  const referenceMonth = parseReferenceMonth(text);

  // Título SEO: "Placa X - MARCA MODELO ANO (modelo ANOMODELO)"
  const titleMatch = text.match(
    /Placa\s+[A-Z0-9]{7}\s*[-–]\s*([A-Z0-9 .\-\/]+?)\s+(\d{4})\s*\(modelo\s+(\d{4})\)/i,
  );

  const resolvedBrand = brand ?? titleMatch?.[1]?.split(/\s+/)[0] ?? null;
  const resolvedModel =
    model ??
    (titleMatch
      ? titleMatch[1].replace(new RegExp(`^${resolvedBrand}\\s*`, "i"), "").trim()
      : null);

  const versions = parseFipeBlocks(text, resolvedBrand).map((version) => ({
    ...version,
    brand: version.brand || resolvedBrand || "",
    modelYear: yearModel,
    fuel: mapFuelHint(fuelRaw) ?? version.fuel,
    referenceMonth: referenceMonth ?? version.referenceMonth,
    score: scoreModelMatch(resolvedModel, version.model),
  }));

  versions.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (!resolvedBrand && !resolvedModel && versions.length === 0) {
    throw new Error(
      "Não foi possível ler os dados desta placa no PlacaFipe. Tente de novo em instantes.",
    );
  }

  return {
    plate,
    brand: resolvedBrand,
    model: resolvedModel,
    version: resolvedModel,
    year: year ?? (titleMatch ? Number(titleMatch[2]) : null),
    yearModel:
      yearModel ?? (titleMatch ? Number(titleMatch[3]) : null) ?? year,
    color,
    fuel: mapFuelHint(fuelRaw),
    engine: engineCc,
    versions,
    sourceUrl,
  };
}

async function fetchText(url: string, headers?: HeadersInit): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,text/plain,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; GaragemBot/1.0; +https://suagaragem.net)",
        ...headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (!text || text.length < 200) return null;
    if (/Attention Required|cf-error|Just a moment/i.test(text) && text.length < 20_000) {
      return null;
    }
    return text;
  } catch (error) {
    console.warn("[plate-lookup] fetch falhou:", url, error);
    return null;
  }
}

/**
 * Consulta placafipe.com pela placa. Não exige token.
 */
export async function lookupVehicleByPlate(
  rawPlate: string,
  category?: string | null,
): Promise<PlateLookupResult> {
  void category;
  const plate = normalizePlate(rawPlate);
  if (plate.length < 7) {
    throw new Error("Informe uma placa válida (ABC1D23 ou ABC1234).");
  }

  const sourceUrl = `${PLACAFIPE_SITE}/placa/${encodeURIComponent(plate)}`;

  // 1) HTML direto
  let text = await fetchText(sourceUrl, {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  });

  // 2) Fallback: leitor jina (bypass Cloudflare)
  if (!text) {
    text = await fetchText(`https://r.jina.ai/${sourceUrl}`, {
      Accept: "text/plain",
      "User-Agent": "Mozilla/5.0 GaragemAdmin/1.0",
    });
  }

  if (!text) {
    throw new Error(
      "PlacaFipe indisponível no momento (bloqueio ou timeout). Tente novamente em alguns segundos.",
    );
  }

  return parseLookupText(plate, text, sourceUrl);
}

/** Último dígito da placa para o campo público "final da placa". */
export function plateEndFromPlate(plate: string): string | null {
  const normalized = normalizePlate(plate);
  if (!normalized) return null;
  const last = normalized.slice(-1);
  return /\d/.test(last) ? last : null;
}

export function placafipeUrl(plate: string) {
  return `${PLACAFIPE_SITE}/placa/${encodeURIComponent(normalizePlate(plate))}`;
}
