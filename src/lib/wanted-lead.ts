/**
 * Pedido de quem não encontrou o modelo.
 * Grava em LeadVenda (mesma lista do admin), com source `nao-encontrou`.
 * O modelo pedido fica em vehicleInfo; e-mail e faixas ficam nas observações.
 */

import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { WANTED_LEAD_SOURCE } from "@/lib/leads";
import { isVehicleCuid } from "@/lib/vehicle-slug";

export { WANTED_LEAD_SOURCE };

export const WANTED_LEAD_SUCCESS =
  "Recebemos o modelo que você pediu. A gente entra em contato quando aparecer.";

export const WANTED_LEAD_FAILURE =
  "Não conseguimos guardar o pedido agora. Tente de novo.";

const EMAIL_LINE = /^E-mail:\s*(\S+)/m;

export type WantedLeadPage = "estoque" | "ficha";

export type WantedLeadDraft = {
  name: string;
  phone: string;
  email: string;
  model: string;
  yearMin: number | null;
  yearMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  kmMin: number | null;
  kmMax: number | null;
  sourcePage: WantedLeadPage;
  pagePath: string;
  contextLabel: string;
  interestVehicleId: string | null;
};

export type WantedLeadState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

export type ParsedWantedLead =
  | { ok: true; ignored: boolean; lead: WantedLeadDraft | null }
  | { ok: false; message: string; fieldErrors: Record<string, string> };

function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").replace(/\s+/g, " ").trim();
}

function phoneDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith("55")
  ) {
    digits = digits.slice(2);
  }
  return digits;
}

function parseYear(raw: string): number | null | "invalid" {
  if (!raw) return null;
  if (!/^\d{4}$/.test(raw)) return "invalid";
  const year = Number(raw);
  const max = new Date().getFullYear() + 1;
  if (year < 1950 || year > max) return "invalid";
  return year;
}

function parseMoney(raw: string): number | null | "invalid" {
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return "invalid";
  const value = Math.round(Number(normalized));
  if (!Number.isFinite(value) || value <= 0 || value > 5_000_000) {
    return "invalid";
  }
  return value;
}

function parseKm(raw: string): number | null | "invalid" {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "invalid";
  const value = Number(digits);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) {
    return "invalid";
  }
  return value;
}

function hasConsent(value: string) {
  return value === "sim" || value === "on" || value === "1" || value === "true";
}

function safePath(value: string) {
  const path = value.trim().slice(0, 180);
  if (!path.startsWith("/")) return "";
  if (/\s|:\\|\/\//.test(path)) return "";
  return path;
}

function rangeLine(
  label: string,
  min: number | null,
  max: number | null,
  format: (value: number) => string,
) {
  if (min != null && max != null) return `${label}: ${format(min)} a ${format(max)}`;
  if (min != null) return `${label}: a partir de ${format(min)}`;
  if (max != null) return `${label}: até ${format(max)}`;
  return null;
}

export function formatWantedLeadNotes(lead: WantedLeadDraft) {
  const lines = [
    `E-mail: ${lead.email}`,
    `Modelo pedido: ${lead.model}`,
    rangeLine("Ano", lead.yearMin, lead.yearMax, (value) => String(value)),
    rangeLine("Preço", lead.priceMin, lead.priceMax, (value) =>
      formatCurrencyBRL(value),
    ),
    rangeLine("Km", lead.kmMin, lead.kmMax, (value) => formatNumberBR(value)),
    lead.contextLabel
      ? lead.sourcePage === "ficha"
        ? `Anúncio aberto: ${lead.contextLabel}`
        : `Filtro: ${lead.contextLabel}`
      : null,
    lead.pagePath ? `Página: ${lead.pagePath}` : null,
  ];
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

/** E-mail gravado na observação do lead — a tabela não tem coluna própria. */
export function emailFromLeadNotes(notes: string | null | undefined) {
  const match = notes?.match(EMAIL_LINE);
  const email = match?.[1]?.trim().toLowerCase() ?? "";
  if (!email || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

export function toLeadVendaData(lead: WantedLeadDraft) {
  return {
    name: lead.name,
    phone: lead.phone,
    vehicleInfo: lead.model,
    plate: "",
    km: null as number | null,
    notes: formatWantedLeadNotes(lead),
    interestVehicleId: lead.interestVehicleId,
    source: WANTED_LEAD_SOURCE,
    photoUrls: [] as string[],
  };
}

export function parseWantedLeadForm(data: FormData): ParsedWantedLead {
  if (text(data, "website")) {
    return { ok: true, ignored: true, lead: null };
  }

  const name = text(data, "name");
  const email = text(data, "email").toLowerCase();
  const phone = phoneDigits(text(data, "phone"));
  const model = text(data, "model");
  const yearMinRaw = text(data, "yearMin");
  const yearMaxRaw = text(data, "yearMax");
  const priceMinRaw = text(data, "priceMin");
  const priceMaxRaw = text(data, "priceMax");
  const kmMinRaw = text(data, "kmMin");
  const kmMaxRaw = text(data, "kmMax");
  const consent = text(data, "consent");
  const sourcePage: WantedLeadPage =
    text(data, "sourcePage") === "ficha" ? "ficha" : "estoque";
  const pagePath = safePath(text(data, "pagePath"));
  const contextLabel = text(data, "contextLabel").slice(0, 180);
  const interestRaw = text(data, "interestVehicleId");
  const interestVehicleId = isVehicleCuid(interestRaw) ? interestRaw : null;

  const fieldErrors: Record<string, string> = {};
  if (model.length < 2) {
    fieldErrors.model = "Informe o modelo que você procura.";
  } else if (model.length > 80) {
    fieldErrors.model = "Use até 80 caracteres no modelo.";
  }
  if (name.length < 3) fieldErrors.name = "Informe seu nome.";
  else if (name.length > 80) fieldErrors.name = "Use até 80 caracteres no nome.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    fieldErrors.email = "Informe um e-mail válido.";
  }
  if (phone.length < 10 || phone.length > 11) {
    fieldErrors.phone = "Informe um telefone com DDD.";
  }

  const yearMin = parseYear(yearMinRaw);
  const yearMax = parseYear(yearMaxRaw);
  const maxYear = new Date().getFullYear() + 1;
  if (yearMin === "invalid") {
    fieldErrors.yearMin = `Ano entre 1950 e ${maxYear}.`;
  }
  if (yearMax === "invalid") {
    fieldErrors.yearMax = `Ano entre 1950 e ${maxYear}.`;
  }
  if (
    typeof yearMin === "number" &&
    typeof yearMax === "number" &&
    yearMin > yearMax
  ) {
    fieldErrors.yearMax = "O ano final precisa ser igual ou maior que o inicial.";
  }

  const priceMin = parseMoney(priceMinRaw);
  const priceMax = parseMoney(priceMaxRaw);
  if (priceMin === "invalid") fieldErrors.priceMin = "Informe um preço válido.";
  if (priceMax === "invalid") fieldErrors.priceMax = "Informe um preço válido.";
  if (
    typeof priceMin === "number" &&
    typeof priceMax === "number" &&
    priceMin > priceMax
  ) {
    fieldErrors.priceMax = "O preço final precisa ser igual ou maior que o inicial.";
  }

  const kmMin = parseKm(kmMinRaw);
  const kmMax = parseKm(kmMaxRaw);
  if (kmMin === "invalid") fieldErrors.kmMin = "Informe uma quilometragem válida.";
  if (kmMax === "invalid") fieldErrors.kmMax = "Informe uma quilometragem válida.";
  if (typeof kmMin === "number" && typeof kmMax === "number" && kmMin > kmMax) {
    fieldErrors.kmMax =
      "A quilometragem final precisa ser igual ou maior que a inicial.";
  }

  if (!hasConsent(consent)) {
    fieldErrors.consent = "Confirme o uso dos dados para enviar.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Confira os campos destacados.",
      fieldErrors,
    };
  }

  return {
    ok: true,
    ignored: false,
    lead: {
      name,
      phone,
      email,
      model,
      yearMin: typeof yearMin === "number" ? yearMin : null,
      yearMax: typeof yearMax === "number" ? yearMax : null,
      priceMin: typeof priceMin === "number" ? priceMin : null,
      priceMax: typeof priceMax === "number" ? priceMax : null,
      kmMin: typeof kmMin === "number" ? kmMin : null,
      kmMax: typeof kmMax === "number" ? kmMax : null,
      sourcePage,
      pagePath,
      contextLabel,
      interestVehicleId,
    },
  };
}
