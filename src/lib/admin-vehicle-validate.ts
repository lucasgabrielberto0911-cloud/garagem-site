/** Regras da ficha no painel — vitrine, não ERP. */

export const MIN_LISTING_PRICE = 1;
export const MAX_LISTING_PRICE = 9_999_999;
export const MIN_KM = 0;
export const MAX_KM = 999_999;

export type VehicleListingFields = {
  brand?: string | null;
  model?: string | null;
  fuel?: string | null;
  transmission?: string | null;
  color?: string | null;
  km?: number | null;
  price?: number | null;
};

export type VehicleListingIssue = {
  field: keyof VehicleListingFields | "form";
  message: string;
};

function trim(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function validateVehicleListing(
  input: VehicleListingFields,
): VehicleListingIssue[] {
  const issues: VehicleListingIssue[] = [];
  if (!trim(input.brand)) {
    issues.push({ field: "brand", message: "Informe a marca." });
  }
  if (!trim(input.model)) {
    issues.push({ field: "model", message: "Informe o modelo." });
  }
  if (!trim(input.fuel)) {
    issues.push({ field: "fuel", message: "Informe o combustível." });
  }
  if (!trim(input.transmission)) {
    issues.push({ field: "transmission", message: "Informe o câmbio." });
  }
  if (!trim(input.color)) {
    issues.push({
      field: "color",
      message: "Informe a cor (fica vazia no anúncio se faltar).",
    });
  }

  const km = input.km;
  if (km == null || !Number.isFinite(km)) {
    issues.push({ field: "km", message: "Informe a quilometragem." });
  } else if (km < MIN_KM || km > MAX_KM) {
    issues.push({
      field: "km",
      message: `KM deve ficar entre ${MIN_KM.toLocaleString("pt-BR")} e ${MAX_KM.toLocaleString("pt-BR")}.`,
    });
  }

  const price = input.price;
  if (price == null || !Number.isFinite(price) || price < MIN_LISTING_PRICE) {
    issues.push({ field: "price", message: "Informe um preço válido." });
  } else if (price > MAX_LISTING_PRICE) {
    issues.push({
      field: "price",
      message: "Preço acima do teto do anúncio. Confira o valor.",
    });
  }

  return issues;
}

export function vehicleListingError(input: VehicleListingFields) {
  const issues = validateVehicleListing(input);
  return issues[0]?.message ?? null;
}

export function kmHint(km: number) {
  if (!Number.isFinite(km)) return null;
  if (km === 0) return "KM 0 — só use em seminovo zero km de verdade.";
  if (km > 400_000) return "KM alto — confira se o número está certo.";
  return null;
}
