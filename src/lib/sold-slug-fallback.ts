import type { Metadata } from "next";
import {
  KNOWN_BRAND_KEYS,
  brandKey,
  formatBrandName,
  formatModelName,
} from "@/lib/format";
import { site } from "@/lib/site";
import {
  CATALOG_BODY_RULES,
  MODEL_CANONICAL,
  MOTO_MODEL_PREFIXES,
} from "@/lib/vehicle-display";
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

const MOTO_ONLY_BRAND_KEYS = new Set([
  "yamaha", "kawasaki", "harley-davidson", "harley", "royal enfield",
  "triumph", "ducati", "dafra", "shineray", "haojue", "bajaj",
]);

const MOTO_MODELS = new Set([
  ...MOTO_MODEL_PREFIXES,
  "cbr", "nxr", "adv", "sahara", "tornado", "falcon", "nc", "mt", "mt09",
  "xmax", "neo", "fluo", "r15", "r1", "versys", "z650", "z900", "vulcan",
  "gsx", "vstrom", "intruder", "burgman", "meteor", "himalayan", "hunter",
  "interceptor", "dominar", "ybr", "tenere", "sh", "elite",
]);

const MOTO_ACRONYM_MODELS = new Set([
  "cg", "cb", "cbr", "xre", "nxr", "pcx", "adv", "nc", "mt", "gsx", "xtz", "sh",
]);

const COMPOUND_MODELS: Record<string, string> = {
  ...MODEL_CANONICAL,
  "hr v": "HR-V", "cr v": "CR-V", "wr v": "WR-V", "zr v": "ZR-V",
  "t cross": "T-Cross", "x trail": "X-Trail", "s cross": "S-Cross",
  "c hr": "C-HR", "e js1": "E-JS1", "gt r": "GT-R", "v strom": "V-Strom",
  "corolla cross": "Corolla Cross", "onix plus": "Onix Plus",
  "grand siena": "Grand Siena", "grand vitara": "Grand Vitara",
  "grand livina": "Grand Livina", "grand cherokee": "Grand Cherokee",
  "santa fe": "Santa Fe", "range rover": "Range Rover",
  "discovery sport": "Discovery Sport", "new fiesta": "New Fiesta",
  "new civic": "New Civic", "hilux sw4": "Hilux SW4",
  "pajero sport": "Pajero Sport", "pajero tr4": "Pajero TR4",
  "pajero full": "Pajero Full", "pajero dakar": "Pajero Dakar",
  "l200 triton": "L200 Triton", "eclipse cross": "Eclipse Cross",
  "sandero stepway": "Sandero Stepway", "palio weekend": "Palio Weekend",
  "ka sedan": "Ka Sedan", "c4 cactus": "C4 Cactus", "c4 lounge": "C4 Lounge",
  "c4 picasso": "C4 Picasso", "c3 aircross": "C3 Aircross",
  "tiggo 2": "Tiggo 2", "tiggo 3x": "Tiggo 3x", "tiggo 5x": "Tiggo 5x",
  "tiggo 7": "Tiggo 7", "tiggo 8": "Tiggo 8", "arrizo 6": "Arrizo 6",
  "dolphin mini": "Dolphin Mini", "song plus": "Song Plus", "song pro": "Song Pro",
  "yuan plus": "Yuan Plus", "yuan pro": "Yuan Pro", "haval h6": "Haval H6",
  "ora 03": "Ora 03", "africa twin": "Africa Twin", "cb twister": "CB Twister",
  "yaris sedan": "Yaris Sedan", "yaris hatch": "Yaris Hatch",
  "city hatch": "City Hatch", "city sedan": "City Sedan", "civic si": "Civic Si",
  "golf gti": "Golf GTI", "polo gts": "Polo GTS", "up tsi": "Up TSI",
  "c 180": "C 180", "c 200": "C 200", "c 250": "C 250", "c 300": "C 300",
  "a 200": "A 200", "a 250": "A 250", "b 200": "B 200", "cla 200": "CLA 200",
  "gla 200": "GLA 200", "glb 200": "GLB 200", "glc 250": "GLC 250", "glc 300": "GLC 300",
  "xc 40": "XC 40", "xc 60": "XC 60", "xc 90": "XC 90",
};

const SPECIAL_SINGLE_MODELS: Record<string, string> = {
  up: "Up", sw4: "SW4", rav4: "RAV4", ix35: "ix35", crv: "CR-V",
  hrv: "HR-V", wrv: "WR-V", zrv: "ZR-V", tcross: "T-Cross", tr4: "TR4",
  s10: "S10", l200: "L200", hb20: "HB20", hb20s: "HB20S", hb20x: "HB20X",
  "320i": "320i", "328i": "328i", "118i": "118i", "120i": "120i",
  xc40: "XC40", xc60: "XC60", xc90: "XC90", c40: "C40", ex30: "EX30",
};

const GENERIC_BODY_TOKENS = new Set([
  "sw", "perua", "pickup", "caminhon", "suv", "crossover", "sedan", "hatch", "weekend",
]);

const EXTRA_CAR_MODELS = (
  "yaris golf taos tiguan fusca kombi fastback commander wrangler cherokee bronco " +
  "territory maverick edge focus fiesta i30 veloster azera elantra captiva spin " +
  "equinox trailblazer astra vectra meriva zafira agile classic punto linea bravo " +
  "idea doblo freemont ducato clio megane fluence kardian master kangoo livina tiida " +
  "206 207 208 307 308 408 500 2008 3008 5008 c3 c4 basalt picanto cerato sorento " +
  "soul stonic niro carnival bongo vitara jimny swift sx4 impreza forester outback " +
  "wrx x1 x2 x3 x4 x5 x6 a1 a3 a4 a5 q3 q5 q7 q8 evoque defender discovery velar " +
  "tiggo arrizo icar dolphin song yuan seal king haval ora rampage 1500 2500 3500 " +
  "fiorino accord cooper countryman cayenne macan panamera 911 daily"
).split(" ");

const KNOWN_CAR_MODELS: Map<string, string> = (() => {
  const map = new Map<string, string>();
  const register = (token: string) => {
    const clean = token.toLowerCase().trim();
    if (!clean || clean.includes(" ") || GENERIC_BODY_TOKENS.has(clean)) return;
    map.set(clean, SPECIAL_SINGLE_MODELS[clean] ?? formatModelName(clean));
  };
  for (const rule of CATALOG_BODY_RULES) {
    for (const part of rule.pattern.source.split("|")) {
      const cleaned = part.replace(/\b|\[[- ]\]\?|\?/g, "").replace(/[^a-z0-9 ]/gi, "");
      register(cleaned);
    }
  }
  for (const token of EXTRA_CAR_MODELS) register(token);
  for (const key of Object.keys(SPECIAL_SINGLE_MODELS)) register(key);
  return map;
})();

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
    for (const pair of [`${tokens[0]} ${tokens[1]}`, `${tokens[0]}-${tokens[1]}`]) {
      if (KNOWN_BRAND_KEYS.has(pair)) {
        const brand = formatBrandName(pair);
        return { brand, brandKey: brandKey(brand), consumed: 2 };
      }
    }
  }
  const first = tokens[0];
  if (!KNOWN_BRAND_KEYS.has(first)) return null;
  const brand = formatBrandName(first);
  return { brand, brandKey: brandKey(brand), consumed: 1 };
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

/**
 * Extrai modelo apenas da allowlist fechada (compostos, motos conhecidas ou modelos de catálogo).
 * Tokens desconhecidos, arbitrários ou ofensivos nunca são refletidos.
 */
function extractModel(
  tokens: string[],
  brandKeyValue: string,
): { model: string | null; isMotoModel: boolean } {
  if (tokens.length === 0) return { model: null, isMotoModel: false };

  const [t0, t1] = tokens;
  if (t1) {
    const pairKey = `${t0} ${t1}`;
    const pair = COMPOUND_MODELS[pairKey];
    if (pair) {
      const isMotoModel =
        MOTO_MODELS.has(t0) ||
        pairKey === "v strom" ||
        pairKey === "africa twin" ||
        pairKey === "cb twister" ||
        pairKey === "fazer 250" ||
        pairKey === "fazer fz25" ||
        pairKey === "fazer fz 25";
      return { model: pair, isMotoModel };
    }
  }

  if (MOTO_MODELS.has(t0)) {
    const label0 = MOTO_ACRONYM_MODELS.has(t0)
      ? t0.toUpperCase()
      : formatModelName(t0);
    const model =
      t1 && /^\d{2,4}[a-z]?$/i.test(t1) && !isValidVehicleYear(t1)
        ? `${label0} ${t1.toUpperCase()}`
        : label0;
    return { model, isMotoModel: true };
  }

  const knownCar = KNOWN_CAR_MODELS.get(t0);
  if (knownCar) {
    return {
      model: knownCar,
      isMotoModel: MOTO_ONLY_BRAND_KEYS.has(brandKeyValue),
    };
  }

  return { model: null, isMotoModel: false };
}

/**
 * Extrai marca, modelo e ano a partir de um slug antigo `/estoque/<slug>`.
 * Slugs sem marca conhecida + modelo válido da allowlist devolvem `label: null`.
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
 * 2) proximidade de ano (quando inferido do slug) e faixa de preço próxima (inferida da marca);
 * 3) senão os mais recentes.
 * Mantém quantidade par no celular quando há 3+ candidatos (3 → 2), preservando o caso de 1 único.
 */
export function selectSimilarVehiclesForSoldSlug<T extends SoldFallbackCandidate>(
  vehicles: T[],
  parsed: ParsedSoldVehicleSlug,
  limit = 4,
): T[] {
  const available = vehicles.filter((vehicle) => vehicle.status === "disponivel");
  if (available.length === 0 || limit <= 0) return [];

  const sorted = !parsed.isVehicleLike
    ? [...available].sort((a, b) => {
        const recency = createdTimestamp(b.createdAt) - createdTimestamp(a.createdAt);
        if (recency !== 0) return recency;
        if (Boolean(b.featured) !== Boolean(a.featured)) {
          return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        }
        return b.yearModel - a.yearModel;
      })
    : (() => {
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

        return [...available].sort((a, b) => {
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
        });
      })();

  const picked = sorted.slice(0, limit);
  if (picked.length >= 3 && picked.length % 2 === 1) {
    return picked.slice(0, picked.length - 1);
  }
  return picked;
}
