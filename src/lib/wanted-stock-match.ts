import { formatCurrencyBRL } from "./format";
import { WANTED_LEAD_SOURCE } from "./leads";
import { site } from "./site";
import { vehiclePath } from "./vehicle-slug";

export type MatchLead = { id: string; name: string; phone: string; vehicleInfo: string; notes: string | null; source: string | null; status: string };
export type MatchVehicle = { id: string; brand: string; model: string; version: string | null; yearModel: number; price: number; km: number; transmission: string; status: string; historical: boolean };
export type MatchPreparationVehicle = { id: string; brand: string; model: string; color: string | null; year: number | null; km: number | null; ready: boolean; posted: boolean };
export const MATCH_DISMISSED_ACTION = "pedido-estoque-dispensado";

function tokens(value: string): string[] {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/([a-z])-([a-z])/g, "$1$2").match(/[a-z]+|\d+/g) ?? [];
}

function range(notes: string, label: string): [number | null, number | null] | null | false {
  const line = notes.split("\n").find(line => line.trim().startsWith(label + ":"));
  if (!line) return null;
  const value = line.slice(line.indexOf(":") + 1).trim().replace(/R\$\s*/g, "").replace(/\./g, "").replace(/,/g, ".");
  const match = value.match(/^(?:(a partir de|até)\s+)?(\d+(?:\.\d+)?)(?:\s+a\s+(\d+(?:\.\d+)?))?$/);
  if (!match || (match[1] && match[3])) return false;
  const number = Number(match[2]);
  const result: [number | null, number | null] = match[1] === "até" ? [null, number] : match[1] === "a partir de" ? [number, null] : [number, match[3] ? Number(match[3]) : number];
  return result[0] !== null && result[1] !== null && result[0] > result[1] ? false : result;
}

function isOpenWantedLead(lead: MatchLead): boolean {
  return lead.source === WANTED_LEAD_SOURCE && !["fechado", "perdido"].includes(lead.status);
}

function matchesModelFacts(
  vehicleInfo: string,
  modelName: string,
  factParts: Array<string | number | null | undefined>,
): boolean {
  const request = tokens(vehicleInfo);
  const model = tokens(modelName);
  const anchor = model[0];
  const facts = new Set(tokens(factParts.filter((part) => part != null && part !== "").join(" ")));
  if (!request.length || !anchor || !request.includes(anchor) || !request.every(word => facts.has(word))) return false;
  const modelNumber = model.find(word => /^\d+$/.test(word));
  if (modelNumber && !request.includes(modelNumber)) return false;
  return true;
}

function checkNumericRange(
  notes: string,
  label: "Ano" | "Preço" | "Km",
  actual: number | null | undefined,
): "matched" | "none" | "mismatch" {
  const bounds = range(notes, label);
  if (bounds === false) return "mismatch";
  if (!bounds) return "none";
  if (actual == null || !Number.isFinite(actual)) return "mismatch";
  if (label === "Preço" && actual <= 0) return "mismatch";
  if ((bounds[0] !== null && actual < bounds[0]) || (bounds[1] !== null && actual > bounds[1])) return "mismatch";
  return "matched";
}

function leadWhatsAppRecipient(lead: MatchLead): { phone: string; firstName: string } | null {
  const digits = lead.phone.replace(/\D/g, "");
  const hasCountryCode = lead.phone.trim().startsWith("+") || digits.length > 11;
  const phone = hasCountryCode ? digits : "55" + digits;
  if (!/^55\d{10,11}$/.test(phone)) return null;
  const firstName = lead.name.trim().split(/\s+/)[0] || "";
  return { phone, firstName };
}

/** Conservador: todos os termos do pedido precisam existir nos fatos do veículo. */
export function wantedStockMatch(lead: MatchLead, vehicle: MatchVehicle): string[] | null {
  if (!isOpenWantedLead(lead) || vehicle.historical || vehicle.status !== "disponivel") return null;
  if (!matchesModelFacts(lead.vehicleInfo, vehicle.model, [vehicle.brand, vehicle.model, vehicle.version, vehicle.yearModel, vehicle.transmission])) return null;
  const matched = ["Modelo"];
  for (const [label, actual] of [["Ano", vehicle.yearModel], ["Preço", vehicle.price], ["Km", vehicle.km]] as const) {
    const status = checkNumericRange(lead.notes ?? "", label, actual);
    if (status === "mismatch") return null;
    if (status === "matched") matched.push(label);
  }
  const transmission = (lead.notes ?? "").split("\n").find(line => line.startsWith("Câmbio:"))?.slice(7).trim();
  if (transmission) {
    if (tokens(transmission).join(" ") !== tokens(vehicle.transmission).join(" ")) return null;
    matched.push("Câmbio");
  }
  return matched;
}

/**
 * Cruza pedido aberto com veículo em preparação.
 * Preço e câmbio ainda não existem nessa etapa e ficam para confirmação do consultor.
 */
export function wantedPreparationMatch(lead: MatchLead, prep: MatchPreparationVehicle): string[] | null {
  if (!isOpenWantedLead(lead)) return null;
  if (!matchesModelFacts(lead.vehicleInfo, prep.model, [prep.brand, prep.model, prep.year, prep.color])) return null;
  const matched = ["Modelo"];
  for (const [label, actual] of [["Ano", prep.year], ["Km", prep.km]] as const) {
    const status = checkNumericRange(lead.notes ?? "", label, actual);
    if (status === "mismatch") return null;
    if (status === "matched") matched.push(label);
  }
  return matched;
}

export function matchWhatsApp(lead: MatchLead, vehicle: MatchVehicle) {
  const recipient = leadWhatsAppRecipient(lead);
  if (!recipient) return null;
  const label = [vehicle.brand, vehicle.model, vehicle.version, vehicle.yearModel].filter(Boolean).join(" ");
  const price = Number.isFinite(vehicle.price) && vehicle.price > 0 ? ", por " + formatCurrencyBRL(vehicle.price) : "";
  const message = "Olá, " + recipient.firstName + "! Aqui é da Garagem. Você pediu um " + lead.vehicleInfo + ". Temos este " + label + price + ", que pode fazer sentido para você. Quer conversar sobre ele? " + site.url + vehiclePath(vehicle);
  return "https://wa.me/" + recipient.phone + "?text=" + encodeURIComponent(message);
}

export function matchPreparationWhatsApp(lead: MatchLead, prep: MatchPreparationVehicle) {
  const recipient = leadWhatsAppRecipient(lead);
  if (!recipient) return null;
  const label = [prep.brand, prep.model, prep.color, prep.year].filter(Boolean).join(" ");
  const message = "Olá, " + recipient.firstName + "! Aqui é da Garagem. Você pediu um " + lead.vehicleInfo + ". Acabou de chegar um " + label + " que está em preparação aqui com a gente. Quer saber mais sobre ele?";
  return "https://wa.me/" + recipient.phone + "?text=" + encodeURIComponent(message);
}
