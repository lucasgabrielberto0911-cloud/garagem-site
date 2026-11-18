import { formatNumberBR } from "@/lib/format";
import { absoluteUrl } from "@/lib/seo";
import { WHATSAPP_BRAND, whatsappUrl } from "@/lib/site";
import { coverSrc, type VehicleCardPhoto } from "@/lib/stock-query";
import { formatVehicleDisplay } from "@/lib/vehicle-display";
import { vehiclePath, vehicleSlug } from "@/lib/vehicle-slug";

export const TRADE_TRANSMISSION_OPTIONS = ["Manual", "Automático"] as const;
export type TradeTransmission = (typeof TRADE_TRANSMISSION_OPTIONS)[number];

export const TRADE_CONDITION_OPTIONS = [
  { value: "ótimo", label: "Ótimo" },
  { value: "bom", label: "Bom" },
  { value: "regular", label: "Regular" },
] as const;
export type TradeConditionValue = (typeof TRADE_CONDITION_OPTIONS)[number]["value"];
export type TradeConditionLabel = (typeof TRADE_CONDITION_OPTIONS)[number]["label"];

export const TRADE_ORIGIN_TAG = "[origem: troca]" as const;

export type TradeInterestVehicle = {
  id: string;
  slug: string;
  title: string;
  year: number;
  path: string;
  url: string;
  photoUrl?: string | null;
};

export type TradeMessageInput = {
  brandModel: string;
  version?: string | null;
  year: string | number;
  km: string | number;
  transmission: string;
  condition: string;
  notes?: string | null;
  interestVehicle?: Pick<TradeInterestVehicle, "title" | "year" | "url"> | null;
  interestText?: string | null;
};

export type TradeFormRawInput = {
  brandModel?: string | null;
  version?: string | null;
  year?: string | null;
  km?: string | null;
  transmission?: string | null;
  condition?: string | null;
  notes?: string | null;
  interestText?: string | null;
};

export type TradeFormFieldErrorKey =
  | "brandModel"
  | "year"
  | "km"
  | "transmission"
  | "condition";

function cleanSingleLine(raw?: string | number | null, maxLen = 120): string {
  if (raw == null) return "";
  return String(raw).replace(/\s+/g, " ").trim().slice(0, maxLen);
}

export function normalizeTradeTransmission(
  raw?: string | null,
): TradeTransmission | null {
  const key = cleanSingleLine(raw, 30)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (key === "manual") return "Manual";
  if (key === "automatico") return "Automático";
  return null;
}

export function normalizeTradeCondition(
  raw?: string | null,
): TradeConditionLabel | null {
  const key = cleanSingleLine(raw, 30)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (key === "otimo") return "Ótimo";
  if (key === "bom") return "Bom";
  if (key === "regular") return "Regular";
  return null;
}

export function normalizeTradeYear(raw?: string | number | null): string | null {
  const cleaned = cleanSingleLine(raw, 15);
  if (!cleaned) return null;
  const match = /^(\d{4})(?:\s*\/\s*(\d{4}))?$/.exec(cleaned);
  if (!match) return null;
  const maxYear = new Date().getFullYear() + 1;
  const first = Number(match[1]);
  if (first < 1950 || first > maxYear) return null;
  if (!match[2]) return String(first);
  const second = Number(match[2]);
  if (second < 1950 || second > maxYear || second < first || second - first > 2) {
    return null;
  }
  return `${first}/${second}`;
}

export function formatTradeKm(raw?: string | number | null): string | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (!digits || digits.length > 7) return null;
  const value = Number(digits);
  if (!Number.isFinite(value) || value < 0 || value > 2_000_000) return null;
  return `${formatNumberBR(value)} km`;
}

export function validateTradeForm(input: TradeFormRawInput):
  | {
      ok: true;
      data: {
        brandModel: string;
        version: string;
        year: string;
        km: string;
        transmission: TradeTransmission;
        condition: TradeConditionLabel;
        notes: string;
        interestText: string;
      };
    }
  | {
      ok: false;
      errors: Partial<Record<TradeFormFieldErrorKey, string>>;
    } {
  const errors: Partial<Record<TradeFormFieldErrorKey, string>> = {};
  const brandModel = cleanSingleLine(input.brandModel, 80);
  const version = cleanSingleLine(input.version, 60);
  const year = normalizeTradeYear(input.year);
  const km = formatTradeKm(input.km);
  const transmission = normalizeTradeTransmission(input.transmission);
  const condition = normalizeTradeCondition(input.condition);
  const notes = cleanSingleLine(input.notes, 280);
  const interestText = cleanSingleLine(input.interestText, 120);

  if (brandModel.length < 2) {
    errors.brandModel = "Informe a marca e o modelo do veículo.";
  }
  if (!year) {
    errors.year = "Informe um ano válido (ex.: 2020 ou 2019/2020).";
  }
  if (!km) {
    errors.km = "Informe a quilometragem aproximada.";
  }
  if (!transmission) {
    errors.transmission = "Selecione o câmbio.";
  }
  if (!condition) {
    errors.condition = "Selecione o estado geral.";
  }

  if (
    Object.keys(errors).length > 0 ||
    !year ||
    !km ||
    !transmission ||
    !condition
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      brandModel,
      version,
      year,
      km,
      transmission,
      condition,
      notes,
      interestText,
    },
  };
}

/**
 * Monta a mensagem organizada em linhas para avaliação de troca via WhatsApp,
 * encerrando sempre com `[origem: troca]`.
 */
export function buildTradeWhatsAppMessage(input: TradeMessageInput): string {
  const brandModel = cleanSingleLine(input.brandModel, 80);
  const version = cleanSingleLine(input.version, 60);
  const year = normalizeTradeYear(input.year) ?? cleanSingleLine(input.year, 15);
  const km = formatTradeKm(input.km) ?? cleanSingleLine(input.km, 24);
  const transmission =
    normalizeTradeTransmission(input.transmission) ??
    cleanSingleLine(input.transmission, 24);
  const condition =
    normalizeTradeCondition(input.condition) ??
    cleanSingleLine(input.condition, 24);
  const notes = cleanSingleLine(input.notes, 280);
  const interestText = cleanSingleLine(input.interestText, 120);

  const lines: string[] = [
    `Oi! Quero avaliar meu veículo para troca na ${WHATSAPP_BRAND}:`,
  ];

  if (brandModel) lines.push(`Marca/modelo: ${brandModel}`);
  if (version) lines.push(`Versão: ${version}`);
  if (year) lines.push(`Ano: ${year}`);
  if (km) lines.push(`Km: ${km}`);
  if (transmission) lines.push(`Câmbio: ${transmission}`);
  if (condition) lines.push(`Estado geral: ${condition}`);
  if (notes) lines.push(`Observações: ${notes}`);

  if (input.interestVehicle) {
    const vehicleTitle = cleanSingleLine(input.interestVehicle.title, 100);
    const vehicleYear = cleanSingleLine(input.interestVehicle.year, 10);
    const vehicleUrl = cleanSingleLine(input.interestVehicle.url, 300);
    if (vehicleTitle) {
      const escapedYear = vehicleYear.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const hasYear =
        Boolean(vehicleYear) && new RegExp(`\\b${escapedYear}\\b`).test(vehicleTitle);
      const label =
        vehicleYear && !hasYear
          ? `${vehicleTitle} (${vehicleYear})`
          : vehicleTitle;
      lines.push(`Carro de interesse: ${label}`);
    }
    if (vehicleUrl) {
      lines.push(`Link: ${vehicleUrl}`);
    }
  } else if (interestText) {
    lines.push(`Carro de interesse: ${interestText}`);
  }

  lines.push(TRADE_ORIGIN_TAG);
  return lines.join("\n");
}

/**
 * Gera a URL oficial do WhatsApp da loja sem parâmetros UTM que ativem
 * mutação posterior do texto, preservando `[origem: troca]` no fim.
 */
export function buildTradeWhatsAppUrl(input: TradeMessageInput): string {
  return whatsappUrl(buildTradeWhatsAppMessage(input), { bare: true });
}

/**
 * Converte um veículo do banco para o resumo de interesse na página `/troca`.
 * Veículos vendidos nunca entram como interesse nem expõem preço.
 */
export function toTradeInterestVehicle(
  vehicle: {
    id: string;
    brand: string;
    model: string;
    version?: string | null;
    yearModel: number;
    km?: number;
    fuel?: string;
    transmission?: string;
    color?: string | null;
    status: string;
    photos?: VehicleCardPhoto[];
  } | null | undefined,
): TradeInterestVehicle | null {
  if (!vehicle || vehicle.status === "vendido") return null;
  const display = formatVehicleDisplay({
    id: vehicle.id,
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version ?? null,
    yearModel: vehicle.yearModel,
    km: vehicle.km ?? 0,
    transmission: vehicle.transmission ?? "",
    color: vehicle.color ?? null,
  });
  const slug = vehicleSlug(vehicle);
  const path = vehiclePath(vehicle);
  const title = [display.title, display.version].filter(Boolean).join(" ");
  return {
    id: vehicle.id,
    slug,
    title,
    year: vehicle.yearModel,
    path,
    url: absoluteUrl(path),
    photoUrl: coverSrc(vehicle.photos) ?? null,
  };
}
