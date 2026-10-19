/**
 * URLs públicas de anúncio: nome legível + id (único).
 * Ex.: /estoque/hyundai-creta-prestige-2022-cmshv22g9000fl204fk6qz9l2
 */

export type VehiclePathInput = {
  id: string;
  brand: string;
  model: string;
  yearModel: number;
  version?: string | null;
};

function slugifyPart(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72);
}

/** Prisma `cuid()` típico: começa com c + alfanumérico. */
export function isVehicleCuid(value: string) {
  return /^c[a-z0-9]{20,32}$/i.test(value);
}

export function vehicleSlug(vehicle: VehiclePathInput) {
  const modelTokens = new Set(
    vehicle.model.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]+/g) ?? [],
  );
  const version = (vehicle.version ?? "")
    .split(/\s+/)
    .filter((token) => {
      const normalized = token.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return !modelTokens.has(normalized.replace(/[^a-z0-9]/g, ""));
    })
    .join(" ");
  const label = [vehicle.brand, vehicle.model, version, String(vehicle.yearModel)]
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .join(" ");
  const base = slugifyPart(label) || "veiculo";
  return `${base}-${vehicle.id}`;
}

export function vehiclePath(vehicle: VehiclePathInput) {
  return `/estoque/${vehicleSlug(vehicle)}`;
}

/**
 * Aceita URL antiga (`/estoque/{cuid}`) ou nova (`/estoque/{nome}-{cuid}`).
 */
export function extractVehicleIdFromParam(param: string): string | null {
  const value = param.trim();
  if (!value) return null;
  if (isVehicleCuid(value)) return value;

  const separator = value.lastIndexOf("-c");
  if (separator === -1) return null;
  const candidate = value.slice(separator + 1);
  return isVehicleCuid(candidate) ? candidate : null;
}
