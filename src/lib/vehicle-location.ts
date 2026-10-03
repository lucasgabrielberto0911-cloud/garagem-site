/**
 * Cidade física do veículo no ES. Fonte da verdade: o campo do admin.
 * Não inferir a cidade pelo modelo.
 */

export const VEHICLE_LOCATION_CITIES = [
  { value: "linhares", label: "Linhares" },
  { value: "serra", label: "Serra" },
  { value: "vitoria", label: "Vitória" },
  { value: "aracruz", label: "Aracruz" },
] as const;

export type VehicleLocationCity =
  (typeof VEHICLE_LOCATION_CITIES)[number]["value"];

/** Default de cadastro novo — mesmo padrão de `category`/`status` no schema. */
export const DEFAULT_VEHICLE_LOCATION_CITY: VehicleLocationCity = "linhares";

/**
 * O admin informa a localização real; modelo e região atendida não a definem.
 */
export const VEHICLE_LOCATION_HINT =
  "Escolha a cidade onde o veículo está hoje. Essa informação aparece no anúncio, nos filtros do estoque e no Marketplace. A região atendida pela loja não muda a localização do veículo.";

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
  return VEHICLE_LOCATION_CITIES.some((city) => city.value === value);
}

/** Aceita as cidades cadastradas, com acento/caixa. Null se vazio ou inválido. */
export function parseVehicleLocationCity(
  value: unknown,
): VehicleLocationCity | null {
  const token = normalizeLocationToken(value);
  return isVehicleLocationCity(token) ? token : null;
}

/** Fallback do schema para leitura (catálogo, chip, ficha). */
export function resolveVehicleLocationCity(value: unknown): VehicleLocationCity {
  return parseVehicleLocationCity(value) ?? DEFAULT_VEHICLE_LOCATION_CITY;
}

export function vehicleLocationLabel(value: unknown) {
  const city = parseVehicleLocationCity(value);
  return (
    VEHICLE_LOCATION_CITIES.find((option) => option.value === city)?.label ?? ""
  );
}

/**
 * CTA do estoque a partir de uma landing de cidade.
 * Filtra apenas cidades aceitas como localização física do veículo.
 */
export function publicCityStockLink(slug: string) {
  const city = parseVehicleLocationCity(slug);
  if (!city) {
    return { href: "/estoque", label: "Ver o estoque", place: "" };
  }
  const place = vehicleLocationLabel(city);
  return {
    href: `/estoque?city=${city}`,
    label: `Ver os que estão em ${place}`,
    place,
  };
}

/** Cidade no feed da Meta, conforme a localização salva no admin. */
export function catalogAddressCity(value: unknown) {
  return vehicleLocationLabel(resolveVehicleLocationCity(value));
}

/**
 * Centros municipais e CEPs centrais de referência; não são endereços da loja.
 * Coordenadas novas: github.com/kelvins/municipios-brasileiros/blob/main/csv/municipios.csv
 * CEPs novos conferidos em viacep.com.br/ws/29015000/json/ e /ws/29190022/json/.
 */
const CATALOG_PLACES: Record<
  VehicleLocationCity,
  { city: string; postalCode: string; latitude: number; longitude: number }
> = {
  linhares: {
    city: "Linhares",
    postalCode: "29900-000",
    latitude: -19.3911,
    longitude: -40.0722,
  },
  vitoria: {
    city: "Vitória",
    postalCode: "29015-000",
    latitude: -20.3155,
    longitude: -40.3128,
  },
  aracruz: {
    city: "Aracruz",
    postalCode: "29190-022",
    latitude: -19.82,
    longitude: -40.2764,
  },
  serra: {
    city: "Serra",
    postalCode: "29160-000",
    latitude: -20.1286,
    longitude: -40.3076,
  },
};

export function catalogPlace(value: unknown) {
  return CATALOG_PLACES[resolveVehicleLocationCity(value)];
}
