/**
 * Pipeline único de exibição do anúncio.
 *
 * Versão (texto FIPE), câmbio, WhatsApp e schema.org passam por aqui para
 * não divergir — ex.: HR-V "Automático" na versão e "Manual" no campo.
 */

import {
  brandKey,
  formatCurrencyBRL,
  formatModelName,
  formatNumberBR,
  formatVehicleLabel,
} from "@/lib/format";
import {
  formatCustomerVehicleWhatsAppText,
  site,
  type CustomerWhatsAppVehicleIntent,
} from "@/lib/site";
import { vehiclePath } from "@/lib/vehicle-slug";

export const MAX_DESTAQUE_BADGES = 3;

export type GearKind =
  | "automatico"
  | "manual"
  | "cvt"
  | "automatizado"
  | "semi";

const GEAR_LABEL: Record<GearKind, string> = {
  automatico: "Automático",
  manual: "Manual",
  cvt: "CVT",
  automatizado: "Automatizado",
  semi: "Semi-automático",
};

export function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function foldToken(value: string) {
  return brandKey(value).replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

function tokensOf(value: string) {
  return foldToken(value)
    .split(" ")
    .filter(Boolean);
}

/** Automatico / AUTOMATICO / mecanico → forma acentuada em PT-BR. */
export function applyPtAccents(value: string) {
  return collapseWhitespace(value)
    .replace(/semi[\s-]*automatico/gi, (match) =>
      preserveCap(match, "semi-automático"),
    )
    .replace(/automatico/gi, (match) => preserveCap(match, "automático"))
    .replace(/mecanico/gi, (match) => preserveCap(match, "mecânico"))
    .replace(/hidraulic([oa])/gi, (match, ending: string) =>
      preserveCap(match, `hidráulic${ending.toLowerCase()}`),
    )
    .replace(/eletronic([oa])/gi, (match, ending: string) =>
      preserveCap(match, `eletrônic${ending.toLowerCase()}`),
    );
}

function preserveCap(original: string, replacement: string) {
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toLocaleUpperCase("pt-BR");
  }
  if (original.charAt(0) === original.charAt(0).toUpperCase()) {
    return replacement.charAt(0).toLocaleUpperCase("pt-BR") + replacement.slice(1);
  }
  return replacement;
}

export function formatTransmissionLabel(value: string) {
  const trimmed = applyPtAccents(collapseWhitespace(value));
  if (!trimmed) return "";
  const kind = inferGearFromText(trimmed);
  if (kind) return GEAR_LABEL[kind];
  return formatModelName(trimmed);
}

export function inferGearFromText(value: string): GearKind | null {
  const text = foldToken(value);
  if (!text) return null;
  if (
    /\bsemi[\s-]*automatico\b/.test(text) ||
    /\bsemiautomatico\b/.test(text)
  ) {
    return "semi";
  }
  if (
    /\bcvt\b/.test(text) ||
    /\be[- ]?cvt\b/.test(text) ||
    /\bi[- ]?cvt\b/.test(text)
  ) {
    return "cvt";
  }
  if (
    /\bautomatizado\b/.test(text) ||
    /\bdualogic\b/.test(text) ||
    /\bi[- ]?motion\b/.test(text) ||
    /\beasytronic\b/.test(text) ||
    /\bgsr\b/.test(text)
  ) {
    return "automatizado";
  }
  if (
    /\bautomatico\b/.test(text) ||
    /\bautomatic\b/.test(text) ||
    /(^|[\s/])aut\.(?=\s|$)/.test(text)
  ) {
    return "automatico";
  }
  if (
    /\bmanual\b/.test(text) ||
    /\bmecanico\b/.test(text) ||
    /(^|[\s/])mec\.(?=\s|$)/.test(text) ||
    /(^|[\s/])mec(?=\s|$)/.test(text)
  ) {
    return "manual";
  }
  return null;
}

export function gearsConflict(
  version: string | null | undefined,
  transmission: string | null | undefined,
) {
  const fromVersion = inferGearFromText(version ?? "");
  const fromField = inferGearFromText(transmission ?? "");
  if (!fromVersion || !fromField) return false;
  return isManualFamily(fromVersion) !== isManualFamily(fromField);
}

function isManualFamily(kind: GearKind) {
  return kind === "manual";
}

/**
 * Câmbio canônico para card, ficha, WhatsApp e JSON-LD.
 * Se a versão (FIPE) cita um câmbio e o campo aponta o oposto, a versão ganha.
 * CVT na versão é mais específico do que "Automático" no campo — não é conflito.
 */
export function resolveTransmission(
  version: string | null | undefined,
  transmission: string | null | undefined,
) {
  const fieldLabel = formatTransmissionLabel(transmission ?? "");
  const fromVersion = inferGearFromText(version ?? "");
  const fromField = inferGearFromText(fieldLabel);

  if (fromVersion && fromField && gearsConflict(version, fieldLabel)) {
    return GEAR_LABEL[fromVersion];
  }
  if (fromVersion === "cvt") return GEAR_LABEL.cvt;
  if (fromField === "cvt") return GEAR_LABEL.cvt;
  if (fromVersion === "semi" && fromField !== "semi") return GEAR_LABEL.semi;
  if (fromVersion === "automatizado" && fromField === "automatico") {
    return GEAR_LABEL.automatizado;
  }
  return fieldLabel || (fromVersion ? GEAR_LABEL[fromVersion] : "");
}

export function transmissionConflictAlert(
  version: string | null | undefined,
  transmission: string | null | undefined,
) {
  if (!gearsConflict(version, transmission)) return null;
  const resolved = resolveTransmission(version, transmission);
  const field = formatTransmissionLabel(transmission ?? "") || "—";
  return `Câmbio diverge da versão (${field} × ${resolved})`;
}

export function suggestedTransmission(
  version: string | null | undefined,
  transmission: string | null | undefined,
  allowed?: readonly string[],
) {
  const resolved = resolveTransmission(version, transmission);
  if (!allowed || allowed.length === 0) return resolved;
  const match = allowed.find(
    (option) => foldToken(option) === foldToken(resolved),
  );
  return match ?? resolved;
}

const FIPE_JUNK = [
  /\bsed\.?/gi,
  /\bhatch\.?/gi,
  /\b\d{1,2}p\b/gi,
  /\b(8|12|16|20|24)v\b/gi,
];

const GEAR_STRIP =
  /\b(semi[\s-]*automático|semiautomático|automático|automatico|automatizado|cvt|manual|mecânico|mecanico)\b/gi;

/**
 * Versão curta para card/ficha: tira lixo FIPE, câmbio (já vai no campo),
 * tokens repetidos do modelo e espaços duplos.
 */
function mostlyUppercase(value: string) {
  const letters = value.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 3) return false;
  const upper = [...letters].filter((ch) => ch === ch.toUpperCase()).length;
  return upper / letters.length >= 0.7;
}

export function shortVersion(
  version: string | null | undefined,
  model = "",
) {
  let text = applyPtAccents(collapseWhitespace(version ?? ""));
  if (!text) return "";

  text = text.replace(/\bflexpower\b/gi, "Flex");
  for (const pattern of FIPE_JUNK) {
    text = text.replace(pattern, " ");
  }
  text = stripDuplicateTokens(text, model);
  text = collapseRepeatedDisplacement(text);
  text = text.replace(GEAR_STRIP, " ");
  text = collapseWhitespace(text).replace(/^[\s/.,-]+|[\s/.,-]+$/g, "");
  if (mostlyUppercase(text)) {
    text = applyPtAccents(formatModelName(text));
  }
  text = text.replace(/\bflexpower\b/gi, "Flex").replace(/\bflex\b/gi, "Flex");
  return collapseWhitespace(text);
}

function stripDuplicateTokens(version: string, model: string) {
  const modelTokens = new Set(tokensOf(model));
  if (modelTokens.size === 0) return version;
  return version
    .split(/\s+/)
    .filter((token) => {
      const key = foldToken(token);
      if (!key) return false;
      if (modelTokens.has(key)) return false;
      return true;
    })
    .join(" ");
}

/** “FOX 1.6 BLUEMOTION 1.6 GII” — a mesma cilindrada não aparece duas vezes. */
function collapseRepeatedDisplacement(version: string) {
  const seen = new Set<string>();
  return version
    .split(/\s+/)
    .filter((token) => {
      const key = foldToken(token);
      const match = key.match(/^(\d+[.,]\d+)$/);
      if (!match) return Boolean(key);
      const liters = match[1].replace(",", ".");
      if (seen.has(liters)) return false;
      seen.add(liters);
      return true;
    })
    .join(" ");
}

export function buildVehicleTitle(brand: string, model: string, year?: number) {
  return formatVehicleLabel(brand, model, year);
}

/** Marca + modelo + versão curta + ano, sem "XS XS" / "ALTIS ALTIS". */
export function buildVehicleFullLabel(input: {
  brand: string;
  model: string;
  version?: string | null;
  yearModel: number;
}) {
  const title = formatVehicleLabel(input.brand, input.model);
  const version = shortVersion(input.version, input.model);
  return collapseWhitespace(`${title}${version ? ` ${version}` : ""} ${input.yearModel}`);
}

export type VehicleWhatsAppIntent = CustomerWhatsAppVehicleIntent;

export function formatVehicleWhatsAppMessage(input: {
  brand: string;
  model: string;
  version?: string | null;
  yearModel: number;
  transmission?: string | null;
  price?: number | null;
  path?: string;
  isMoto?: boolean;
  intent?: VehicleWhatsAppIntent;
  /** Ignorado: o pré-preenchido usa o wordmark “Garagem”. */
  siteName?: string;
  origin?: string;
}) {
  const label = collapseWhitespace(buildVehicleFullLabel(input));
  const usableLabel = label && !/^\d{4}$/.test(label) ? label : "";
  const price = input.price;
  const priceLabel =
    typeof price === "number" && Number.isFinite(price) && price > 0
      ? formatCurrencyBRL(price)
      : "";
  const line = formatCustomerVehicleWhatsAppText({
    intent: input.intent ?? "interest",
    label: usableLabel,
    priceLabel,
    isMoto: input.isMoto,
  });

  const lines = [line];
  const path = (input.path ?? "").trim();
  if (path) {
    const origin = (input.origin ?? site.url).replace(/\/$/, "");
    lines.push(`${origin}${path.startsWith("/") ? path : `/${path}`}`);
  }
  return lines.join("\n");
}

export function collapseDuplicateAccessories(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items) {
    const value = collapseWhitespace(raw);
    if (!value) continue;
    const key = foldToken(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function featuredBadgeIds<T extends { id: string; featured?: boolean }>(
  vehicles: T[],
  limit = MAX_DESTAQUE_BADGES,
) {
  const ids = new Set<string>();
  if (limit <= 0) return ids;
  for (const vehicle of vehicles) {
    if (!vehicle.featured) continue;
    ids.add(vehicle.id);
    if (ids.size >= limit) break;
  }
  return ids;
}

/**
 * Cores de vitrine: um rótulo canônico.
 * HR-V no estoque vinha como Grafite no campo e Cinza na ficha/descrição.
 */
const COLOR_CANONICAL: Record<string, string> = {
  grafite: "Cinza",
  "cinza grafite": "Cinza",
  "cinza-grafite": "Cinza",
  gray: "Cinza",
  grey: "Cinza",
  cinza: "Cinza",
  prata: "Prata",
  silver: "Prata",
  branco: "Branco",
  branca: "Branco",
  white: "Branco",
  preto: "Preto",
  preta: "Preto",
  black: "Preto",
  vermelho: "Vermelho",
  vermelha: "Vermelho",
  red: "Vermelho",
  azul: "Azul",
  blue: "Azul",
  verde: "Verde",
  green: "Verde",
  dourado: "Dourado",
  dourada: "Dourado",
  bege: "Bege",
  marrom: "Marrom",
  vinho: "Vinho",
  laranja: "Laranja",
  amarelo: "Amarelo",
  amarela: "Amarelo",
};

export function colorKey(value: string) {
  return foldToken(value);
}

export function formatColorLabel(color: string | null | undefined) {
  const trimmed = collapseWhitespace(color ?? "");
  if (!trimmed) return "";
  const key = colorKey(trimmed);
  if (COLOR_CANONICAL[key]) return COLOR_CANONICAL[key];
  if (/\bgrafite\b/.test(key) || /\bcinza\b/.test(key)) return "Cinza";
  return formatModelName(applyPtAccents(trimmed));
}

/** Valores gravados que devem cair no mesmo chip/filtro do rótulo canônico. */
export function colorFilterValues(selected: string) {
  const canonical = formatColorLabel(selected);
  if (!canonical) return [];
  const aliases = Object.entries(COLOR_CANONICAL)
    .filter(([, label]) => foldToken(label) === foldToken(canonical))
    .map(([key]) => key);
  const unique = new Set<string>([canonical, selected, ...aliases]);
  return [...unique].filter(Boolean);
}

export function colorWhere(selected: string | null | undefined) {
  const value = collapseWhitespace(selected ?? "");
  if (!value) return {};
  const values = colorFilterValues(value);
  if (values.length <= 1) {
    return { color: { equals: values[0] ?? value, mode: "insensitive" as const } };
  }
  return {
    OR: values.map((item) => ({
      color: { equals: item, mode: "insensitive" as const },
    })),
  };
}

export function formatUpdatedAt(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Atualizado em ${date.toLocaleDateString("pt-BR")}`;
}

export type VehicleDisplayInput = {
  id: string;
  brand: string;
  model: string;
  version?: string | null;
  yearModel: number;
  transmission: string;
  km?: number;
  price?: number;
  color?: string | null;
  category?: string;
  status?: string;
  featured?: boolean;
  updatedAt?: Date | string | null;
};

export type VehicleDisplay = {
  title: string;
  titleWithYear: string;
  version: string;
  transmission: string;
  transmissionConflict: boolean;
  fullLabel: string;
  color: string;
  path: string;
  metaParts: string[];
};

export function formatVehicleDisplay(vehicle: VehicleDisplayInput): VehicleDisplay {
  const title = formatVehicleLabel(vehicle.brand, vehicle.model);
  const titleWithYear = formatVehicleLabel(
    vehicle.brand,
    vehicle.model,
    vehicle.yearModel,
  );
  const version = shortVersion(vehicle.version, vehicle.model);
  const transmission = resolveTransmission(
    vehicle.version,
    vehicle.transmission,
  );
  const color = formatColorLabel(vehicle.color);
  const fullLabel = buildVehicleFullLabel(vehicle);
  const metaParts = [
    String(vehicle.yearModel),
    vehicle.km != null ? `${formatNumberBR(vehicle.km)} km` : "",
    transmission,
    color,
  ].filter(Boolean);

  return {
    title,
    titleWithYear,
    version,
    transmission,
    transmissionConflict: gearsConflict(vehicle.version, vehicle.transmission),
    fullLabel,
    color,
    path: vehiclePath(vehicle),
    metaParts,
  };
}
