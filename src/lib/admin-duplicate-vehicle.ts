import type { Prisma } from "@prisma/client";

export const DUPLICATE_DRAFT_KEY = "vehicle:new";
export const DUPLICATE_BACKUP_KEY = "vehicle:new:backup";

export type DuplicateSourceVehicle = {
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  year?: number | null;
  yearModel?: number | null;
  fuel?: string | null;
  transmission?: string | null;
  engine?: string | null;
  doors?: number | null;
  accessories?: unknown;
  description?: string | null;
  warranty?: string | null;
  inspection?: string | null;
  consigned?: boolean | null;
  hasSpareKey?: boolean | null;
  hasManual?: boolean | null;
  locationCity?: string | null;
  // Campos específicos do carro a serem ignorados:
  plate?: string | null;
  plateEnd?: string | null;
  km?: number | null;
  price?: number | null;
  color?: string | null;
  photos?: unknown;
  featured?: boolean | null;
};

/**
 * Monta o rascunho de duplicação copiando somente os campos de modelo
 * (marca, modelo, versão, combustível, câmbio, opcionais, legenda).
 *
 * Campos individuais do carro específico NUNCA são copiados:
 * fotos, placa, km, preço, cor, dados de compra e destaque.
 */
export function buildDuplicateDraftPayload(
  source: DuplicateSourceVehicle,
): Prisma.InputJsonObject {
  const brand = (source.brand ?? "").trim();
  const model = (source.model ?? "").trim();
  const version = (source.version ?? "").trim();
  const category = (source.category ?? "carro").trim();
  const fuel = (source.fuel ?? "").trim();
  const transmission = (source.transmission ?? "").trim();
  const engine = (source.engine ?? "").trim();
  const description = (source.description ?? "").trim();
  const warranty = (source.warranty ?? "").trim();
  const inspection = (source.inspection ?? "").trim();
  const locationCity = (source.locationCity ?? "").trim();
  const yearStr = source.year ? String(source.year) : "";
  const yearModelStr = source.yearModel ? String(source.yearModel) : "";
  const doorsStr = source.doors ? String(source.doors) : "";
  const accessories = Array.isArray(source.accessories)
    ? source.accessories.filter(
        (item): item is string => typeof item === "string",
      )
    : [];

  return {
    step: 1,
    fields: {
      category,
      brand,
      model,
      version,
      year: yearStr,
      yearModel: yearModelStr,
      fuel,
      transmission,
      engine,
      doors: doorsStr,
      description,
      warranty,
      inspection,
      consigned: source.consigned ? "on" : "",
      hasSpareKey: source.hasSpareKey ? "on" : "",
      hasManual: source.hasManual ? "on" : "",
      // Campos específicos zerados expressamente:
      plate: "",
      plateEnd: "",
      km: "",
      price: "",
      color: "",
      purchasePrice: "",
      purchase: "",
      featured: "",
    },
    photos: [] as Prisma.InputJsonValue[],
    brand,
    model,
    version,
    color: "",
    year: yearStr,
    yearModel: yearModelStr,
    plate: "",
    plateEnd: "",
    engine,
    purchase: "",
    description,
    status: "disponivel",
    values: {},
    category,
    locationCity,
    fuel,
    transmission,
    accessories,
    consigned: Boolean(source.consigned),
  };
}

/**
 * Verifica se um AdminDraft existente contém dados preenchidos que seriam
 * perdidos caso o rascunho seja sobrescrito.
 * Ignora rascunhos expirados ou vazios.
 */
export function hasDraftContent(
  draft:
    | {
        payload?: unknown;
        photoUrls?: string[] | null;
        expiresAt?: Date | null;
      }
    | null
    | undefined,
  now: Date = new Date(),
): boolean {
  if (!draft) return false;
  if (draft.expiresAt && draft.expiresAt <= now) return false;
  if (Array.isArray(draft.photoUrls) && draft.photoUrls.length > 0) return true;
  if (!draft.payload || typeof draft.payload !== "object") return false;

  const payload = draft.payload as Record<string, unknown>;
  if (Array.isArray(payload.photos) && payload.photos.length > 0) return true;

  const textKeys = [
    "brand",
    "model",
    "version",
    "description",
    "color",
    "plate",
    "engine",
    "purchase",
  ];
  for (const key of textKeys) {
    if (typeof payload[key] === "string" && payload[key].trim().length > 0) {
      return true;
    }
  }

  if (Array.isArray(payload.accessories) && payload.accessories.length > 0) {
    return true;
  }

  if (payload.fields && typeof payload.fields === "object") {
    const fields = payload.fields as Record<string, unknown>;
    for (const val of Object.values(fields)) {
      if (typeof val === "string" && val.trim().length > 0) {
        return true;
      }
    }
  }

  return false;
}

