import { extractVehicleIdFromParam } from "@/lib/vehicle-slug";

/**
 * Anúncios que 404am (apagados / históricos) mas ainda circulam em sitemap
 * ou links antigos. Soft-redirect para o estoque.
 */
export const RETIRED_SHORT_PATHS = [
  "/honda-hrv-2020",
  "/chevrolet-cruze-lt",
  "/etios-xls-2018",
] as const;

export const RETIRED_STOCK_PATHS = [
  "/estoque/toyota-etios-xs-xs-1-5-16v-flex-automatico-2017-cmturwtw30000l804s8700mu4",
] as const;

export const RETIRED_VEHICLE_IDS = [
  "cmturwtw30000l804s8700mu4",
] as const;

const RETIRED_ID_SET = new Set<string>(RETIRED_VEHICLE_IDS);

const RETIRED_SLUG_SET = new Set(
  RETIRED_STOCK_PATHS.map((path) => path.replace(/^\/estoque\//, "")),
);

export function isRetiredStockSlug(param: string) {
  const value = param.trim().toLowerCase();
  if (!value) return false;
  if (RETIRED_SLUG_SET.has(value)) return true;
  const id = extractVehicleIdFromParam(value);
  return Boolean(id && RETIRED_ID_SET.has(id));
}

export function retiredRedirectSources() {
  return [
    ...RETIRED_SHORT_PATHS,
    ...RETIRED_STOCK_PATHS,
  ];
}
