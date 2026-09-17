/**
 * Cidade física do veículo no ES. Fonte da verdade: o campo do admin.
 * Não inferir Serra/Linhares pelo modelo.
 */

export const VEHICLE_LOCATION_CITIES = [
  { value: "linhares", label: "Linhares" },
  { value: "serra", label: "Serra" },
] as const;

export type VehicleLocationCity =
  (typeof VEHICLE_LOCATION_CITIES)[number]["value"];

/** Default de cadastro novo — mesmo padrão de `category`/`status` no schema. */
export const DEFAULT_VEHICLE_LOCATION_CITY: VehicleLocationCity = "linhares";

/**
 * Texto de ajuda do painel. Heurística atual (pode mudar) — NÃO usar no código
 * para classificar anúncio.
 */
export const VEHICLE_LOCATION_HINT =
  "Onde o veículo está hoje, no Espírito Santo. Marketplace e o time usam este campo — não o modelo. Serra hoje costuma incluir Start 160s, BIZ 125, Civic EXL, Corolla Altis, Mobi e Palio Weekend, mas a fonte da verdade é o que você marcar aqui.";

function normalizeLocationToken(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isVehicleLocationCity(
  value: unknown,
): value is VehicleLocationCity {
  return value === "serra" || value === "linhares";
}

/** Aceita só serra | linhares (com acento/caixa). Null se vazio ou inválido. */
export function parseVehicleLocationCity(
  value: unknown,
): VehicleLocationCity | null {
  const token = normalizeLocationToken(value);
  if (token === "serra") return "serra";
  if (token === "linhares") return "linhares";
  return null;
}

/** Fallback do schema para leitura (catálogo, chip, ficha). */
export function resolveVehicleLocationCity(value: unknown): VehicleLocationCity {
  return parseVehicleLocationCity(value) ?? DEFAULT_VEHICLE_LOCATION_CITY;
}

export function vehicleLocationLabel(value: unknown) {
  const city = parseVehicleLocationCity(value);
  if (city === "serra") return "Serra";
  if (city === "linhares") return "Linhares";
  return "";
}

/** Cidade no feed da Meta — nunca mais chutar Aracruz. */
export function catalogAddressCity(value: unknown) {
  return vehicleLocationLabel(resolveVehicleLocationCity(value));
}
