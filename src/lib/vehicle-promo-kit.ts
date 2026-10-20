import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { vehiclePath, type VehiclePathInput } from "@/lib/vehicle-slug";

export type PromoVehicle = VehiclePathInput & {
  year: number;
  km: number;
  transmission?: string | null;
  fuel?: string | null;
  color?: string | null;
  price: number;
  status: string;
  accessories?: string[] | string | null;
  photos?: Array<{ url: string; thumbnailUrl?: string | null }>;
};

function parseAccessories(raw?: string[] | string | null): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

export function buildWhatsAppPromo(
  vehicle: PromoVehicle,
  siteOrigin = "https://www.suagaragem.net",
): string {
  const isSold = vehicle.status === "vendido";
  const title = [vehicle.brand, vehicle.model, vehicle.version]
    .filter(Boolean)
    .join(" ");
  const yearText =
    vehicle.year === vehicle.yearModel
      ? `${vehicle.year}`
      : `${vehicle.year}/${vehicle.yearModel}`;
  const kmText = `${formatNumberBR(vehicle.km)} km`;
  const url = `${siteOrigin}${vehiclePath(vehicle)}`;

  const accessories = parseAccessories(vehicle.accessories);
  const highlights = accessories.slice(0, 4).join(" · ");

  const gearFuel = [
    vehicle.transmission ? `Câmbio: ${vehicle.transmission}` : "",
    vehicle.fuel,
  ]
    .filter(Boolean)
    .join(" · ");

  const lines = [
    `🚗 *${title}*`,
    `📅 Ano: ${yearText}`,
    `📍 KM: ${kmText}`,
    ...(gearFuel ? [`⚙️ ${gearFuel}`] : []),
  ];

  if (vehicle.color) {
    lines.push(`🎨 Cor: ${vehicle.color}`);
  }

  if (highlights) {
    lines.push(`✨ Destaques: ${highlights}`);
  }

  if (!isSold) {
    lines.push(`💰 Valor: ${formatCurrencyBRL(vehicle.price)}`);
  } else {
    lines.push(`🏷️ Veículo vendido`);
  }

  lines.push(`🔗 Confira fotos e ficha completa: ${url}`);
  lines.push("");
  lines.push("Garagem · Linhares/ES");

  return lines.join("\n");
}

export function buildInstagramPromo(
  vehicle: PromoVehicle,
  siteOrigin = "https://www.suagaragem.net",
): string {
  const isSold = vehicle.status === "vendido";
  const title = [vehicle.brand, vehicle.model, vehicle.version]
    .filter(Boolean)
    .join(" ");
  const yearText =
    vehicle.year === vehicle.yearModel
      ? `${vehicle.year}`
      : `${vehicle.year}/${vehicle.yearModel}`;
  const kmText = `${formatNumberBR(vehicle.km)} km`;
  const accessories = parseAccessories(vehicle.accessories);

  const brandTag = vehicle.brand.toLowerCase().replace(/[^a-z0-9]/g, "");
  const modelTag = vehicle.model.toLowerCase().replace(/[^a-z0-9]/g, "");

  const domain = siteOrigin.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const lines = [
    `${title} — ${yearText}`,
    "",
    ...(!isSold ? [`🏷️ ${formatCurrencyBRL(vehicle.price)}`] : ["🏷️ Vendido"]),
    `• ${kmText}`,
    ...(vehicle.transmission ? [`• Câmbio ${vehicle.transmission}`] : []),
    ...(vehicle.fuel ? [`• ${vehicle.fuel}`] : []),
    ...(vehicle.color ? [`• Cor ${vehicle.color}`] : []),
    ...accessories.slice(0, 5).map((item) => `• ${item}`),
    "",
    "Garantia e procedência garantida na Garagem.",
    `📲 Chame no WhatsApp ou confira no site ${domain}!`,
    "",
    `#garagem #seminovos #linhares #carros #veiculos${brandTag ? ` #${brandTag}` : ""}${modelTag ? ` #${modelTag}` : ""}`,
  ];

  return lines.join("\n");
}
