import { formatCurrencyBRL } from "./format";
import { WANTED_LEAD_SOURCE } from "./leads";
import { site } from "./site";
import { vehiclePath } from "./vehicle-slug";

export type MatchLead = { id: string; name: string; phone: string; vehicleInfo: string; notes: string | null; source: string | null; status: string };
export type MatchVehicle = { id: string; brand: string; model: string; version: string | null; yearModel: number; price: number; km: number; transmission: string; status: string; historical: boolean };
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

/** Conservador: todos os termos do pedido precisam existir nos fatos do veículo. */
export function wantedStockMatch(lead: MatchLead, vehicle: MatchVehicle): string[] | null {
  if (lead.source !== WANTED_LEAD_SOURCE || ["fechado", "perdido"].includes(lead.status) || vehicle.historical || vehicle.status !== "disponivel") return null;
  const request = tokens(lead.vehicleInfo);
  const model = tokens(vehicle.model);
  const anchor = model[0];
  const facts = new Set(tokens([vehicle.brand, vehicle.model, vehicle.version, vehicle.yearModel, vehicle.transmission].filter(Boolean).join(" ")));
  if (!request.length || !anchor || !request.includes(anchor) || !request.every(word => facts.has(word))) return null;
  const modelNumber = model.find(word => /^\d+$/.test(word));
  if (modelNumber && !request.includes(modelNumber)) return null;
  const matched = ["Modelo"];
  for (const [label, actual] of [["Ano", vehicle.yearModel], ["Preço", vehicle.price], ["Km", vehicle.km]] as const) {
    const bounds = range(lead.notes ?? "", label);
    if (bounds === false) return null;
    if (bounds) {
      if (label === "Preço" && actual <= 0) return null;
      if (!Number.isFinite(actual) || (bounds[0] !== null && actual < bounds[0]) || (bounds[1] !== null && actual > bounds[1])) return null;
      matched.push(label);
    }
  }
  const transmission = (lead.notes ?? "").split("\n").find(line => line.startsWith("Câmbio:"))?.slice(7).trim();
  if (transmission) {
    if (tokens(transmission).join(" ") !== tokens(vehicle.transmission).join(" ")) return null;
    matched.push("Câmbio");
  }
  return matched;
}

export function matchWhatsApp(lead: MatchLead, vehicle: MatchVehicle) {
  const digits = lead.phone.replace(/\D/g, "");
  const phone = digits.startsWith("55") ? digits : "55" + digits;
  if (!/^55\d{10,11}$/.test(phone)) return null;
  const firstName = lead.name.trim().split(/\s+/)[0] || "";
  const label = [vehicle.brand, vehicle.model, vehicle.version, vehicle.yearModel].filter(Boolean).join(" ");
  const price = Number.isFinite(vehicle.price) && vehicle.price > 0 ? ", por " + formatCurrencyBRL(vehicle.price) : "";
  const message = "Olá, " + firstName + "! Aqui é da Sua Garagem. Você pediu um " + lead.vehicleInfo + ". Temos este " + label + price + ", que pode fazer sentido para você. Quer conversar sobre ele? " + site.url + vehiclePath(vehicle);
  return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
}
