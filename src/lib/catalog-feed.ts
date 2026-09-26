/**
 * Feed CSV do estoque para o catálogo de VEÍCULOS da Meta (Automotive Inventory Ads).
 * Colunas iguais ao CSV manual do Commerce Manager.
 * `vehicle_id` = Prisma CUID — o mesmo valor enviado em `content_ids` do Pixel.
 *
 * Referência: https://developers.facebook.com/docs/marketing-api/auto-ads/reference/
 * Imagens de catálogo: JPEG ou PNG (WebP não entra no spec de imagem da Meta).
 */

import { formatBrandName, formatModelName, vehicleSeoDescription } from "@/lib/format";
import { catalogPhotoJpgPath, extensionFromPhotoUrl } from "@/lib/photo-archive";
import { site } from "@/lib/site";
import {
  buildVehicleFullLabel,
  formatColorLabel,
  inferGearFromText,
  resolveTransmission,
} from "@/lib/vehicle-display";
import { catalogPlace } from "@/lib/vehicle-location";
import { vehiclePath } from "@/lib/vehicle-slug";

export type CatalogFeedPhoto = { id: string; url: string };

export type CatalogFeedVehicle = {
  id: string;
  category: string;
  brand: string;
  model: string;
  version: string | null;
  yearModel: number;
  km: number;
  price: number;
  fuel: string;
  transmission: string;
  color: string | null;
  description: string | null;
  /** Motor / cilindrada — entra no combustível quando a versão não traz Flex. */
  engine?: string | null;
  locationCity?: string | null;
  photos: CatalogFeedPhoto[];
};

/** Quantas imagens o header sempre declara. Colunas vazias ficam em branco. */
export const CATALOG_IMAGE_SLOTS = 8;

const FIXED_BEFORE_IMAGES = [
  "vehicle_id",
  "title",
  "description",
  "url",
  "make",
  "model",
  "year",
  "mileage.value",
  "mileage.unit",
] as const;

const FIXED_AFTER_IMAGES = [
  "body_style",
  "transmission",
  "fuel_type",
  "price",
  "exterior_color",
  "state_of_vehicle",
  "address",
  "latitude",
  "longitude",
  "availability",
  "condition",
  "dealer_id",
  "dealer_name",
  "postal_code",
  "dealer_phone",
] as const;

export const META_CSV_COLUMNS = [
  ...FIXED_BEFORE_IMAGES,
  ...Array.from({ length: CATALOG_IMAGE_SLOTS }, (_, index) => `image[${index}].url`),
  ...FIXED_AFTER_IMAGES,
] as const;

export type CatalogCsvColumn = (typeof META_CSV_COLUMNS)[number];

/**
 * Dealer no catálogo Meta "Garagem - Estoque de Veículos".
 * O feed antigo saía como SUAGARAMEM (G faltando).
 */
export const CATALOG_DEALER_ID = "SUAGARAGEM";

export const CATALOG_UTM = {
  utm_source: "meta",
  utm_medium: "dinamico",
  utm_campaign: "catalogo_veiculos",
} as const;

export function csvEscape(value: string) {
  const text = value.replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function formatCatalogPrice(price: number) {
  const amount = Number.isFinite(price) ? Math.max(0, price) : 0;
  return `${amount.toFixed(2)} BRL`;
}

/** Enum da Meta (case-insensitive): Automatic | Manual. */
export function mapCatalogTransmission(value: string) {
  const text = value.toLowerCase();
  if (text.includes("auto") || text.includes("cvt")) return "Automatic";
  return "Manual";
}

/** Pixel de Automotive Inventory Ads usa o valor em minúsculas. */
export function mapPixelTransmission(value: string) {
  return mapCatalogTransmission(value) === "Automatic" ? "automatic" : "manual";
}

/** Enum da Meta: DIESEL, ELECTRIC, FLEX, GASOLINE, HYBRID, OTHER. */
export function mapCatalogFuel(value: string) {
  const text = value.toLowerCase();
  if (text.includes("diesel")) return "DIESEL";
  if (text.includes("eletr") || text.includes("elétr")) return "ELECTRIC";
  if (text.includes("hibr") || text.includes("híbr")) return "HYBRID";
  if (text.includes("flex")) return "FLEX";
  if (text.includes("gasol")) return "GASOLINE";
  return "OTHER";
}

export function mapPixelFuel(value: string) {
  return mapCatalogFuel(value).toLowerCase();
}

function foldCatalogText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Flex, FlexPower, FlexOne, FlexStart ou TB Flex — não casa “flexible”. */
const FLEX_SIGNAL = /\bflex(?:power|one|start)?\b|\btb\s*flex\b/;

function hasFlexSignal(value: string) {
  return FLEX_SIGNAL.test(foldCatalogText(value));
}

/**
 * Linha “Câmbio:” / “Combustível:” da descrição do anúncio.
 * Aceita negrito de WhatsApp (`*Câmbio:*`) e para no próximo emoji.
 */
function extractCatalogFact(
  description: string | null | undefined,
  label: string,
) {
  if (!description) return "";
  const pattern = new RegExp(
    `[*_]*${label}[*_]*\\s*:\\s*(.+?)(?=\\s*(?:[*_]*\\p{Extended_Pictographic}|\\n|$))`,
    "iu",
  );
  return (
    description
      .match(pattern)?.[1]
      ?.replace(/[*_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function catalogGearIsAutomatic(value: string) {
  const kind = inferGearFromText(value);
  return (
    kind === "cvt" ||
    kind === "automatico" ||
    kind === "automatizado" ||
    kind === "semi"
  );
}

/**
 * Câmbio do feed. CVT e automático viram Automatic (enum da Meta).
 * “CVT (automático) com modo manual sequencial” não é câmbio manual:
 * a linha de câmbio da descrição ganha do campo quando ela cita CVT/automático.
 * Versão FIPE × campo continua em `resolveTransmission`.
 */
export function resolveCatalogTransmission(input: {
  version?: string | null;
  transmission?: string | null;
  description?: string | null;
}) {
  const cambio = extractCatalogFact(input.description, "C[aâ]mbio");
  if (cambio && catalogGearIsAutomatic(cambio)) return "Automatic";

  const resolved = resolveTransmission(input.version, input.transmission);
  return mapCatalogTransmission(resolved || input.transmission || "");
}

/**
 * CG 160 e Biz 110/110i são só gasolina. Biz 125 Flex não entra aqui.
 */
function isGasolineOnlyMoto(model: string, version: string, engine: string) {
  const text = foldCatalogText(`${model} ${version} ${engine}`);
  if (hasFlexSignal(text)) return false;
  if (/\bcg\b/.test(text) && /\b160(?!\d)/.test(text)) return true;
  if (/\bbiz\b/.test(text) && /\b110(?!\d)/.test(text)) return true;
  return false;
}

/**
 * Combustível do feed.
 * Carro: Flex / FlexPower / TB Flex na versão, no motor ou na linha
 * “Combustível” vencem um campo Gasolina (HB20S 1.0 TB Flex).
 * Moto: não sai FLEX só porque o campo está Flex — CG/Biz a gasolina
 * (descrição ou modelo) ficam GASOLINE. Biz 125 Flex continua FLEX.
 */
export function resolveCatalogFuel(input: {
  category?: string | null;
  fuel?: string | null;
  model?: string | null;
  version?: string | null;
  engine?: string | null;
  description?: string | null;
}) {
  const fuel = input.fuel ?? "";
  const mapped = mapCatalogFuel(fuel);
  if (mapped === "DIESEL" || mapped === "ELECTRIC" || mapped === "HYBRID") {
    return mapped;
  }

  const model = input.model ?? "";
  const version = input.version ?? "";
  const engine = input.engine ?? "";
  const spec = `${model} ${version} ${engine}`;
  const combustivel = extractCatalogFact(input.description, "Combust[ií]vel");
  const flexInSpec = hasFlexSignal(spec);
  const flexInLine = hasFlexSignal(combustivel);
  const gasolineOnlyLine =
    /\bgasolina\b/.test(foldCatalogText(combustivel)) && !flexInLine;
  const moto = (input.category ?? "carro").toLowerCase() === "moto";

  if (moto) {
    if ((gasolineOnlyLine || isGasolineOnlyMoto(model, version, engine)) && !flexInSpec) {
      return "GASOLINE";
    }
    if (flexInSpec || flexInLine) return "FLEX";
    return mapped;
  }

  if (flexInSpec || flexInLine) return "FLEX";
  return mapped;
}

/**
 * Tira nota interna de confirmação da descrição pública do catálogo.
 * Ex.: “(confirmar ano…)”, “(confirmar se é 2022/2023 ou 2023/2023)”.
 */
export function stripCatalogConfirmationNotes(value: string) {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat
    .replace(/\s*[([][^[\]()]*\bconfirmar\b[^[\]()]*[)\]]/gi, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

const BODY_RULES: Array<{ style: string; pattern: RegExp }> = [
  {
    style: "WAGON",
    pattern: /weekend|spacefox|\bsw\b|perua|parati|variant/,
  },
  {
    style: "PICKUP",
    pattern:
      /saveiro|strada|montana|oroch|hilux|ranger|\bs[- ]?10\b|amarok|toro|frontier|\bl200\b|pickup|caminhon/,
  },
  {
    style: "SUV",
    pattern:
      /hr-?v|pulse|kicks|nivus|creta|compass|tracker|t-?cross|renegade|duster|ecosport|captur|tucson|sportage|\bsw4\b|pajero|outlander|rav4|cr-?v|\bsuv\b|crossover/,
  },
  {
    style: "SEDAN",
    pattern:
      /hb20s|prisma|siena|civic|corolla|lancer|voyage|logan|onix plus|cronos|city\b|virtus|jetta|sentra|cruze|cobalt|versa|sedan/,
  },
  {
    style: "HATCHBACK",
    pattern:
      /\bmobi\b|palio|\bhb20\b|argo|\bonix\b|\bgol\b|\bfox\b|\bup\b|\bka\b|\buno\b|celta|corsa|sandero|\bfit\b|march|\bpolo\b|etios|hatch/,
  },
];

/**
 * Carroceria a partir do modelo/versão. Motos ficam OTHER (o enum de
 * inventário não tem motorcycle; vehicle_type é campo à parte).
 * Sem palpite de SEDAN quando o modelo não casa.
 */
export function mapCatalogBodyStyle(
  category: string,
  model = "",
  version: string | null = null,
) {
  if (category === "moto") return "OTHER";
  const text = `${model} ${version ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const rule of BODY_RULES) {
    if (rule.pattern.test(text)) return rule.style;
  }
  return "OTHER";
}

export function mapPixelBodyStyle(
  category: string,
  model = "",
  version: string | null = null,
) {
  return mapCatalogBodyStyle(category, model, version).toLowerCase();
}

/** Consignados entram por padrão. `?consigned=0` tira. */
export function includeConsignedInFeed(value: string | null | undefined) {
  if (value == null || value.trim() === "") return true;
  return !/^(0|false|no|nao|não|exclude)$/i.test(value.trim());
}

export function catalogFeedImageUrl(
  origin: string,
  vehicleId: string,
  photo: CatalogFeedPhoto,
) {
  const url = photo.url.trim();
  if (!url) return "";
  const ext = extensionFromPhotoUrl(url);
  if (ext === "jpg" || ext === "png") return url.split("#")[0]?.split("?")[0] ?? url;
  if (!photo.id) return "";
  return new URL(catalogPhotoJpgPath(vehicleId, photo.id), origin).toString();
}

function catalogTitle(vehicle: CatalogFeedVehicle) {
  return buildVehicleFullLabel(vehicle);
}

function catalogDescription(vehicle: CatalogFeedVehicle) {
  const custom = stripCatalogConfirmationNotes(vehicle.description ?? "");
  if (custom.length >= 20) return custom.slice(0, 5000);
  return vehicleSeoDescription({
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.yearModel,
    price: vehicle.price,
    km: vehicle.km,
    transmission: resolveTransmission(vehicle.version, vehicle.transmission),
    siteName: site.name,
  }).slice(0, 5000);
}

function dealerPhone() {
  const digits = site.whatsappNumber.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    const local =
      rest.length === 9 ? `${rest.slice(0, 5)}-${rest.slice(5)}` : rest;
    return `+55 ${ddd} ${local}`;
  }
  return `+${digits}`;
}

export function catalogVehicleRow(
  vehicle: CatalogFeedVehicle,
  origin: string,
): Record<CatalogCsvColumn, string> | null {
  const images = vehicle.photos
    .map((photo) => catalogFeedImageUrl(origin, vehicle.id, photo))
    .filter(Boolean)
    .slice(0, CATALOG_IMAGE_SLOTS);
  if (images.length === 0) return null;

  const place = catalogPlace(vehicle.locationCity);
  const address = JSON.stringify({
    addr1: "Centro",
    city: place.city,
    region: "Espírito Santo",
    postal_code: place.postalCode,
    country: "Brazil",
  });
  const link = new URL(vehiclePath(vehicle), origin);
  for (const [key, value] of Object.entries(CATALOG_UTM)) {
    link.searchParams.set(key, value);
  }

  const row: Record<string, string> = {
    vehicle_id: vehicle.id,
    title: catalogTitle(vehicle),
    description: catalogDescription(vehicle),
    url: link.toString(),
    make: formatBrandName(vehicle.brand),
    model: formatModelName(vehicle.model),
    year: String(vehicle.yearModel),
    "mileage.value": String(Math.max(0, Math.round(vehicle.km))),
    "mileage.unit": "KM",
    body_style: mapCatalogBodyStyle(vehicle.category, vehicle.model, vehicle.version),
    transmission: resolveCatalogTransmission(vehicle),
    fuel_type: resolveCatalogFuel(vehicle),
    price: formatCatalogPrice(vehicle.price),
    exterior_color: formatColorLabel(vehicle.color) || "Não informado",
    state_of_vehicle: "Used",
    address,
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    availability: "AVAILABLE",
    condition: "EXCELLENT",
    dealer_id: CATALOG_DEALER_ID,
    dealer_name: site.name,
    postal_code: place.postalCode,
    dealer_phone: dealerPhone(),
  };

  for (let index = 0; index < CATALOG_IMAGE_SLOTS; index += 1) {
    row[`image[${index}].url`] = images[index] ?? "";
  }

  return row as Record<CatalogCsvColumn, string>;
}

export function buildCatalogCsv(
  vehicles: CatalogFeedVehicle[],
  origin = site.url,
) {
  const rows = vehicles
    .map((vehicle) => catalogVehicleRow(vehicle, origin))
    .filter((row): row is NonNullable<typeof row> => row != null);

  const lines = [
    META_CSV_COLUMNS.join(","),
    ...rows.map((row) =>
      META_CSV_COLUMNS.map((column) => csvEscape(row[column])).join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

/** Campos recomendados do Pixel (ViewContent / Lead) para o mesmo veículo. */
export function catalogPixelAutoFields(vehicle: {
  category: string;
  model: string;
  version?: string | null;
  fuel: string;
  transmission: string;
  color?: string | null;
  locationCity?: string | null;
  description?: string | null;
  engine?: string | null;
}) {
  const place = catalogPlace(vehicle.locationCity);
  return {
    state_of_vehicle: "Used" as const,
    exterior_color: formatColorLabel(vehicle.color) || undefined,
    transmission: mapPixelTransmission(resolveCatalogTransmission(vehicle)),
    body_style: mapPixelBodyStyle(vehicle.category, vehicle.model, vehicle.version),
    fuel_type: resolveCatalogFuel(vehicle).toLowerCase(),
    postal_code: place.postalCode,
  };
}
