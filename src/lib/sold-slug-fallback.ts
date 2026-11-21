import type { Metadata } from "next";
import {
  KNOWN_BRAND_KEYS,
  brandKey,
  formatBrandName,
  formatModelName,
} from "@/lib/format";
import { site } from "@/lib/site";
import { extractVehicleIdFromParam, isVehicleCuid } from "@/lib/vehicle-slug";

export type ParsedSoldVehicleSlug = {
  /** Rótulo limpo pronto para exibir (ex.: "Toyota Yaris 2022"). Null para slug sem padrão de veículo. */
  label: string | null;
  brand: string | null;
  brandKey: string | null;
  model: string | null;
  year: number | null;
  isMoto: boolean;
  isVehicleLike: boolean;
};

const EMPTY_PARSED: ParsedSoldVehicleSlug = {
  label: null,
  brand: null,
  brandKey: null,
  model: null,
  year: null,
  isMoto: false,
  isVehicleLike: false,
};

const COMPOUND_BRANDS: Record<string, string> = {
  "mercedes benz": "Mercedes-Benz",
  "land rover": "Land Rover",
  "caoa chery": "Caoa Chery",
  "harley davidson": "Harley-Davidson",
  "royal enfield": "Royal Enfield",
  "alfa romeo": "Alfa Romeo",
  "aston martin": "Aston Martin",
  "rolls royce": "Rolls-Royce",
};

const EXTRA_KNOWN_BRANDS: Record<string, string> = {
  triumph: "Triumph",
  ducati: "Ducati",
  dafra: "Dafra",
  shineray: "Shineray",
  haojue: "Haojue",
  bajaj: "Bajaj",
  jac: "JAC",
  troller: "Troller",
  ssangyong: "SsangYong",
  smart: "Smart",
};

const MOTO_ONLY_BRAND_KEYS = new Set([
  "yamaha",
  "kawasaki",
  "harley-davidson",
  "harley",
  "royal enfield",
  "triumph",
  "ducati",
  "dafra",
  "shineray",
  "haojue",
  "bajaj",
]);

const MOTO_MODEL_PREFIXES = new Set([
  "cg", "cb", "cbr", "xre", "nxr", "bros", "biz", "pop", "pcx", "adv",
  "twister", "sahara", "tornado", "falcon", "nc", "fazer", "fz25", "fz15",
  "mt", "lander", "crosser", "factor", "nmax", "xmax", "neo", "fluo", "r15",
  "r3", "ninja", "versys", "z400", "z650", "z900", "vulcan", "gsx", "vstrom",
  "intruder", "burgman", "meteor", "himalayan", "hunter", "classic",
  "interceptor", "dominar",
]);

const COMPOUND_MODELS: Record<string, string> = {
  "hr v": "HR-V",
  "cr v": "CR-V",
  "wr v": "WR-V",
  "t cross": "T-Cross",
  "x trail": "X-Trail",
  "s cross": "S-Cross",
  "c hr": "C-HR",
  "e js1": "E-JS1",
  "gt r": "GT-R",
  "v strom": "V-Strom",
  "corolla cross": "Corolla Cross",
  "onix plus": "Onix Plus",
  "grand siena": "Grand Siena",
  "grand vitara": "Grand Vitara",
  "grand livina": "Grand Livina",
  "grand cherokee": "Grand Cherokee",
  "santa fe": "Santa Fe",
  "range rover": "Range Rover",
  "discovery sport": "Discovery Sport",
  "new fiesta": "New Fiesta",
  "new civic": "New Civic",
  "hilux sw4": "Hilux SW4",
  "pajero sport": "Pajero Sport",
  "pajero tr4": "Pajero TR4",
  "pajero full": "Pajero Full",
  "pajero dakar": "Pajero Dakar",
  "l200 triton": "L200 Triton",
  "eclipse cross": "Eclipse Cross",
  "sandero stepway": "Sandero Stepway",
  "c4 cactus": "C4 Cactus",
  "c4 lounge": "C4 Lounge",
  "c4 picasso": "C4 Picasso",
  "c3 aircross": "C3 Aircross",
  "tiggo 2": "Tiggo 2",
  "tiggo 3x": "Tiggo 3x",
  "tiggo 5x": "Tiggo 5x",
  "tiggo 7": "Tiggo 7",
  "tiggo 8": "Tiggo 8",
  "arrizo 6": "Arrizo 6",
  "dolphin mini": "Dolphin Mini",
  "song plus": "Song Plus",
  "song pro": "Song Pro",
  "yuan plus": "Yuan Plus",
  "yuan pro": "Yuan Pro",
  "haval h6": "Haval H6",
  "ora 03": "Ora 03",
  "africa twin": "Africa Twin",
  "cb twister": "CB Twister",
  "yaris sedan": "Yaris Sedan",
  "yaris hatch": "Yaris Hatch",
  "city hatch": "City Hatch",
  "city sedan": "City Sedan",
  "civic si": "Civic Si",
  "golf gti": "Golf GTI",
  "polo gts": "Polo GTS",
  "up tsi": "Up TSI",
};

const SPECIAL_SINGLE_MODELS: Record<string, string> = {
  up: "Up",
  sw4: "SW4",
  rav4: "RAV4",
  ix35: "ix35",
  crv: "CR-V",
  hrv: "HR-V",
  wrv: "WR-V",
  tcross: "T-Cross",
  tr4: "TR4",
  s10: "S10",
  l200: "L200",
  hb20: "HB20",
  hb20s: "HB20S",
  hb20x: "HB20X",
  "320i": "320i",
};

/** Tokens de especificação/ruído que nunca devem ser tratados sozinhos como nome de modelo. */
const NOISE_MODEL_TOKENS = new Set([
  "veiculo", "carro", "moto", "seminovo", "usado", "flex", "flexone",
  "gasolina", "diesel", "etanol", "eletrico", "hibrido", "manual",
  "automatico", "automatica", "cvt", "turbo", "16v", "8v", "4x4", "4x2",
  "abs", "start", "stop", "aut", "mec", "completo", "basico",
]);

const KNOWN_NUMERIC_MODELS = new Set([
  "206", "207", "208", "307", "308", "408", "500",
  "2008", "3008", "5008", "1500", "2500", "3500",
]);

function normalizeRawSlug(slugOrPath: string): string {
  let clean = (slugOrPath ?? "").trim().split(/[?#]/)[0] ?? "";
  if (!clean) return "";
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // Mantém original se contiver escape malformado.
  }
  clean = clean.replace(/^\/+|\/+$/g, "");
  if (clean.toLowerCase().startsWith("estoque/")) {
    clean = clean.slice("estoque/".length);
  }
  return clean.replace(/^\/+|\/+$/g, "");
}

function stripTrailingCuid(slug: string): string {
  if (isVehicleCuid(slug)) return "";
  const id = extractVehicleIdFromParam(slug);
  return id && slug.endsWith(`-${id}`) ? slug.slice(0, -(id.length + 1)) : slug;
}

function matchBrand(tokens: string[]): {
  brand: string;
  brandKey: string;
  consumed: number;
} | null {
  if (tokens.length === 0) return null;
  if (tokens.length >= 2) {
    const compound = COMPOUND_BRANDS[`${tokens[0]} ${tokens[1]}`];
    if (compound) return { brand: compound, brandKey: brandKey(compound), consumed: 2 };
  }
  const first = tokens[0];
  const label = KNOWN_BRAND_KEYS.has(first)
    ? formatBrandName(first)
    : EXTRA_KNOWN_BRANDS[first];
  return label ? { brand: label, brandKey: brandKey(label), consumed: 1 } : null;
}

function isValidVehicleYear(token: string): boolean {
  if (!/^\d{4}$/.test(token)) return false;
  const n = Number(token);
  return n >= 1980 && n <= new Date().getFullYear() + 2;
}

function extractYearAndModelTokens(tokens: string[]): {
  year: number | null;
  beforeYear: string[];
} {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (isValidVehicleYear(tokens[i])) {
      return { year: Number(tokens[i]), beforeYear: tokens.slice(0, i) };
    }
  }
  return { year: null, beforeYear: tokens };
}

function formatSingleModelToken(token: string): string {
  const lower = token.toLowerCase();
  if (SPECIAL_SINGLE_MODELS[lower]) return SPECIAL_SINGLE_MODELS[lower];
  if (/^\d{3,4}$/.test(lower)) return lower;
  if (/^[a-z]{1,3}\d+[a-z0-9]*$/i.test(lower)) return lower.toUpperCase();
  return formatModelName(lower);
}

function extractModel(
  tokens: string[],
  brandKeyValue: string,
): { model: string | null; isMotoModel: boolean } {
  if (tokens.length === 0) return { model: null, isMotoModel: false };

  const [t0, t1] = tokens;
  if (t1) {
    const pair = COMPOUND_MODELS[`${t0} ${t1}`];
    if (pair) {
      const isMotoModel =
        MOTO_MODEL_PREFIXES.has(t0) ||
        (t0 === "v" && t1 === "strom") ||
        (t0 === "africa" && t1 === "twin");
      return { model: pair, isMotoModel };
    }
  }

  // Prefixo de moto + cilindrada (ex.: cg-160, fazer-250, xre-300, biz-125, mt-03)
  if (MOTO_MODEL_PREFIXES.has(t0)) {
    const label0 = t0.length <= 3 ? t0.toUpperCase() : formatSingleModelToken(t0);
    const model =
      t1 && /^\d{2,4}[a-z]?$/i.test(t1) ? `${label0} ${t1.toUpperCase()}` : label0;
    return { model, isMotoModel: true };
  }

  // Série curta + número (ex.: c-180, gla-200, xc-60)
  if (
    t1 &&
    /^[a-z]{1,3}$/.test(t0) &&
    !NOISE_MODEL_TOKENS.has(t0) &&
    /^\d{2,4}[a-z]?$/i.test(t1) &&
    !isValidVehicleYear(t1)
  ) {
    return {
      model: `${t0.toUpperCase()} ${t1.toUpperCase()}`,
      isMotoModel: MOTO_ONLY_BRAND_KEYS.has(brandKeyValue),
    };
  }

  if (
    NOISE_MODEL_TOKENS.has(t0) ||
    (/^\d+$/.test(t0) && !KNOWN_NUMERIC_MODELS.has(t0)) ||
    t0.length < 2
  ) {
    return { model: null, isMotoModel: false };
  }

  return {
    model: formatSingleModelToken(t0),
    isMotoModel: MOTO_ONLY_BRAND_KEYS.has(brandKeyValue),
  };
}

/**
 * Extrai marca, modelo e ano a partir de um slug antigo `/estoque/<slug>`.
 * Slugs sem marca conhecida + modelo válido devolvem `label: null` para não inventar carro.
 */
export function parseSoldVehicleSlug(slugOrPath: string): ParsedSoldVehicleSlug {
  const normalized = normalizeRawSlug(slugOrPath);
  if (!normalized) return EMPTY_PARSED;

  const base = stripTrailingCuid(normalized);
  if (!base) return EMPTY_PARSED;

  const tokens = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const brandMatch = matchBrand(tokens);
  if (!brandMatch) return EMPTY_PARSED;

  const rest = tokens.slice(brandMatch.consumed);
  if (rest.length === 0) return EMPTY_PARSED;

  const { year, beforeYear } = extractYearAndModelTokens(rest);
  const { model, isMotoModel } = extractModel(beforeYear, brandMatch.brandKey);
  if (!model) return EMPTY_PARSED;

  const isMoto = isMotoModel || MOTO_ONLY_BRAND_KEYS.has(brandMatch.brandKey);
  const label = year
    ? `${brandMatch.brand} ${model} ${year}`
    : `${brandMatch.brand} ${model}`;

  return {
    label,
    brand: brandMatch.brand,
    brandKey: brandMatch.brandKey,
    model,
    year,
    isMoto,
    isVehicleLike: true,
  };
}

/** Mensagem pré-preenchida do WhatsApp para link antigo de veículo vendido/apagado. */
export function soldOldLinkWhatsAppMessage(parsed: ParsedSoldVehicleSlug): string {
  if (parsed.label) {
    return parsed.isMoto
      ? `Oi! Vi o anúncio da ${parsed.label} que já foi vendida. Tem alguma parecida?`
      : `Oi! Vi o anúncio do ${parsed.label} que já foi vendido. Tem algum parecido?`;
  }
  return `Oi! Acessei um anúncio antigo no site da ${site.name} que não está mais disponível. Tem algum parecido no estoque?`;
}

/**
 * Metadados SEO para `/estoque/<slug>` sem veículo correspondente:
 * sempre `noindex, follow` e sem canonical apontando para a página morta.
 */
export function soldOldLinkMetadata(slugOrPath: string): Metadata {
  const parsed = parseSoldVehicleSlug(slugOrPath);
  const title = parsed.label
    ? `${parsed.label} já foi ${parsed.isMoto ? "vendida" : "vendido"} | ${site.name}`
    : `Anúncio indisponível | ${site.name}`;
  const description = parsed.label
    ? `${parsed.isMoto ? "A" : "O"} ${parsed.label} já foi ${parsed.isMoto ? "vendida" : "vendido"}. Veja opções parecidas no estoque da ${site.name} ou fale pelo WhatsApp.`
    : `Esse anúncio não está mais disponível. Veja os seminovos disponíveis no estoque da ${site.name} ou fale pelo WhatsApp.`;

  return {
    title,
    description,
    robots: {
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    },
  };
}

export type SoldFallbackCandidate = {
  id: string;
  category?: string | null;
  brand: string;
  model: string;
  yearModel: number;
  price: number;
  status: string;
  featured?: boolean;
  createdAt?: Date | string | null;
};

function createdTimestamp(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const time = (value instanceof Date ? value : new Date(value)).getTime();
  return Number.isFinite(time) ? time : 0;
}

function normalizedModelKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function medianPrice(prices: number[]): number | null {
  const valid = prices
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 1
    ? valid[mid]
    : Math.round((valid[mid - 1] + valid[mid]) / 2);
}

/**
 * Seleciona até `limit` veículos disponíveis do estoque atual para a página de anúncio vendido:
 * 1) mesma categoria (carro x moto) e mesma marca primeiro (com mesmo modelo no topo);
 * 2) proximidade de ano (quando inferido do slug) e faixa de preço próxima (inferida de matches da marca);
 * 3) senão os mais recentes.
 */
export function selectSimilarVehiclesForSoldSlug<T extends SoldFallbackCandidate>(
  vehicles: T[],
  parsed: ParsedSoldVehicleSlug,
  limit = 4,
): T[] {
  const available = vehicles.filter((vehicle) => vehicle.status === "disponivel");
  if (available.length === 0 || limit <= 0) return [];

  if (!parsed.isVehicleLike) {
    return [...available]
      .sort((a, b) => {
        const recency = createdTimestamp(b.createdAt) - createdTimestamp(a.createdAt);
        if (recency !== 0) return recency;
        if (Boolean(b.featured) !== Boolean(a.featured)) {
          return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        }
        return b.yearModel - a.yearModel;
      })
      .slice(0, limit);
  }

  const targetModelKey = parsed.model ? normalizedModelKey(parsed.model) : "";
  const isSameBrand = (v: T) =>
    Boolean(parsed.brandKey && brandKey(v.brand) === parsed.brandKey);
  const isSameCategory = (v: T) => (v.category === "moto") === parsed.isMoto;
  const isSameModel = (v: T) => {
    if (!targetModelKey) return false;
    const candidateModel = normalizedModelKey(v.model);
    return (
      candidateModel === targetModelKey ||
      candidateModel.startsWith(`${targetModelKey} `) ||
      targetModelKey.startsWith(`${candidateModel} `)
    );
  };

  const referencePrice = medianPrice(
    available
      .filter((v) => isSameCategory(v) && isSameBrand(v))
      .map((v) => v.price),
  );

  return [...available]
    .sort((a, b) => {
      const catDiff = Number(!isSameCategory(a)) - Number(!isSameCategory(b));
      if (catDiff !== 0) return catDiff;

      const brandDiff = Number(!isSameBrand(a)) - Number(!isSameBrand(b));
      if (brandDiff !== 0) return brandDiff;

      if (isSameBrand(a) && isSameBrand(b)) {
        const modelDiff = Number(!isSameModel(a)) - Number(!isSameModel(b));
        if (modelDiff !== 0) return modelDiff;
      }

      if (parsed.year != null) {
        const yearDiff =
          Math.abs(a.yearModel - parsed.year) - Math.abs(b.yearModel - parsed.year);
        if (yearDiff !== 0) return yearDiff;
      }

      if (referencePrice != null && a.price > 0 && b.price > 0) {
        const priceDiff =
          Math.abs(a.price - referencePrice) - Math.abs(b.price - referencePrice);
        if (priceDiff !== 0) return priceDiff;
      }

      const recency = createdTimestamp(b.createdAt) - createdTimestamp(a.createdAt);
      if (recency !== 0) return recency;

      return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    })
    .slice(0, limit);
}
