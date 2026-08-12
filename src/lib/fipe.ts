/**
 * Cliente da API pública FIPE (Parallelum) — uso exclusivo do admin.
 * Docs: https://fipe.parallelum.com.br/api/v2
 */

export const FIPE_API_BASE = "https://fipe.parallelum.com.br/api/v2";

export type FipeVehicleType = "cars" | "motorcycles";

export type FipeBrand = { code: string; name: string };
export type FipeModel = { code: string; name: string };
export type FipeYear = { code: string; name: string };

export type FipeDetail = {
  vehicleType: number;
  price: string;
  brand: string;
  model: string;
  modelYear: number;
  fuel: string;
  codeFipe: string;
  referenceMonth: string;
  fuelAcronym?: string;
};

export function fipeVehicleTypeFromCategory(
  category: string | null | undefined,
): FipeVehicleType {
  return category === "moto" ? "motorcycles" : "cars";
}

/** Converte "R$ 85.608,00" → 85608 */
export function parseFipePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const normalized = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function fipeFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${FIPE_API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`FIPE ${response.status}: ${path}`);
  }

  return (await response.json()) as T;
}

export function fetchFipeBrands(type: FipeVehicleType) {
  return fipeFetch<FipeBrand[]>(`/${type}/brands`);
}

export function fetchFipeModels(type: FipeVehicleType, brandId: string) {
  return fipeFetch<FipeModel[]>(`/${type}/brands/${brandId}/models`);
}

export function fetchFipeYears(
  type: FipeVehicleType,
  brandId: string,
  modelId: string,
) {
  return fipeFetch<FipeYear[]>(
    `/${type}/brands/${brandId}/models/${modelId}/years`,
  );
}

export function fetchFipeDetail(
  type: FipeVehicleType,
  brandId: string,
  modelId: string,
  yearId: string,
) {
  return fipeFetch<FipeDetail>(
    `/${type}/brands/${brandId}/models/${modelId}/years/${yearId}`,
  );
}

export function fetchFipeYearsByCode(
  type: FipeVehicleType,
  fipeCode: string,
) {
  return fipeFetch<FipeYear[]>(`/${type}/${encodeURIComponent(fipeCode)}/years`);
}

export function fetchFipeDetailByCode(
  type: FipeVehicleType,
  fipeCode: string,
  yearId: string,
) {
  return fipeFetch<FipeDetail>(
    `/${type}/${encodeURIComponent(fipeCode)}/years/${encodeURIComponent(yearId)}`,
  );
}

/**
 * Busca o detalhe FIPE pelo código, preferindo o yearId cujo ano bate com
 * modelYear (quando informado).
 */
export async function resolveFipeDetailByCode(
  type: FipeVehicleType,
  fipeCode: string,
  modelYear?: number | null,
): Promise<FipeDetail | null> {
  const years = await fetchFipeYearsByCode(type, fipeCode);
  if (!years.length) return null;

  let yearId = years[0]?.code;
  if (modelYear != null) {
    const match = years.find((item) => {
      const yearPart = Number(String(item.code).split("-")[0]);
      return yearPart === modelYear || item.name.startsWith(String(modelYear));
    });
    if (match) yearId = match.code;
  }
  if (!yearId) return null;
  return fetchFipeDetailByCode(type, fipeCode, yearId);
}
