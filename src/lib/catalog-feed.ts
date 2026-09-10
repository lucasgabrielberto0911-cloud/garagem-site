/**
 * Feed CSV do estoque para o catálogo de veículos da Meta.
 * `vehicle_id` = Prisma CUID — o mesmo valor enviado em `content_ids` do Pixel.
 */

import { vehicleSeoDescription } from "@/lib/format";
import { site } from "@/lib/site";
import {
  buildVehicleFullLabel,
  resolveTransmission,
} from "@/lib/vehicle-display";
import { vehiclePath } from "@/lib/vehicle-slug";

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
  photos: Array<{ url: string }>;
};

const META_CSV_COLUMNS = [
  "vehicle_id",
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "additional_image_link",
  "brand",
  "make",
  "model",
  "year",
  "mileage.value",
  "mileage.unit",
  "address.city",
  "address.region",
  "address.country",
  "exterior_color",
  "transmission",
  "fuel_type",
  "body_style",
  "state_of_vehicle",
  "custom_label_0",
] as const;

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

export function mapCatalogTransmission(value: string) {
  const text = value.toLowerCase();
  if (text.includes("auto") || text.includes("cvt")) return "AUTOMATIC";
  return "MANUAL";
}

export function mapCatalogFuel(value: string) {
  const text = value.toLowerCase();
  if (text.includes("diesel")) return "DIESEL";
  if (text.includes("eletr") || text.includes("elétr")) return "ELECTRIC";
  if (text.includes("hibr") || text.includes("híbr")) return "HYBRID";
  if (text.includes("etanol")) return "ETHANOL";
  if (text.includes("flex")) return "FLEX";
  return "GASOLINE";
}

export function mapCatalogBodyStyle(category: string) {
  return category === "moto" ? "OTHER" : "SEDAN";
}

function catalogTitle(vehicle: CatalogFeedVehicle) {
  return buildVehicleFullLabel(vehicle);
}

function catalogDescription(vehicle: CatalogFeedVehicle) {
  const custom = vehicle.description?.replace(/\s+/g, " ").trim();
  if (custom && custom.length >= 20) return custom.slice(0, 5000);
  return vehicleSeoDescription({
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.yearModel,
    price: vehicle.price,
    km: vehicle.km,
    transmission: resolveTransmission(vehicle.version, vehicle.transmission),
    siteName: site.name,
  });
}

export function catalogVehicleRow(
  vehicle: CatalogFeedVehicle,
  origin: string,
): Record<(typeof META_CSV_COLUMNS)[number], string> | null {
  const photos = vehicle.photos.map((photo) => photo.url.trim()).filter(Boolean);
  if (photos.length === 0) return null;

  const title = catalogTitle(vehicle);
  return {
    vehicle_id: vehicle.id,
    id: vehicle.id,
    title,
    description: catalogDescription(vehicle),
    availability: "in stock",
    condition: "used",
    price: formatCatalogPrice(vehicle.price),
    link: new URL(vehiclePath(vehicle), origin).toString(),
    image_link: photos[0] ?? "",
    additional_image_link: photos.slice(1, 8).join(","),
    brand: vehicle.brand,
    make: vehicle.brand,
    model: vehicle.model,
    year: String(vehicle.yearModel),
    "mileage.value": String(Math.max(0, Math.round(vehicle.km))),
    "mileage.unit": "KM",
    "address.city": "Aracruz",
    "address.region": "ES",
    "address.country": "Brazil",
    exterior_color: vehicle.color?.trim() || "Não informado",
    transmission: mapCatalogTransmission(
      resolveTransmission(vehicle.version, vehicle.transmission),
    ),
    fuel_type: mapCatalogFuel(vehicle.fuel),
    body_style: mapCatalogBodyStyle(vehicle.category),
    state_of_vehicle: "Used",
    custom_label_0: vehicle.category === "moto" ? "moto" : "carro",
  };
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
