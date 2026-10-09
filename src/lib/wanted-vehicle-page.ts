/**
 * O estoque não mostra o formulário. O botão abre /pedido com os mesmos
 * campos e o mesmo envio (source `nao-encontrou`).
 */

import { formatStockWaitlistQuery } from "@/lib/stock-waitlist";
import { STOCK_FILTER_KEYS } from "@/lib/stock-query";

export const WANTED_VEHICLE_PATH = "/pedido";

export const WANTED_VEHICLE_BUTTON_LABEL = "Não achou seu próximo veículo?";

export type WantedVehicleQuery = Partial<
  Record<(typeof STOCK_FILTER_KEYS)[number] | "sem", string>
>;

/** Stable filter identity; order and presentation copy cannot merge two searches. */
export function wantedVehicleDraftContext(params: WantedVehicleQuery) {
  return JSON.stringify(STOCK_FILTER_KEYS.map(key => [key, params[key]?.trim() ?? ""]));
}

export function wantedVehicleHref(
  params: WantedVehicleQuery,
  options?: { empty?: boolean },
) {
  const search = new URLSearchParams();
  for (const key of STOCK_FILTER_KEYS) {
    const value = params[key]?.trim();
    if (value) search.set(key, value);
  }
  if (options?.empty) search.set("sem", "1");
  const qs = search.toString();
  return qs ? `${WANTED_VEHICLE_PATH}?${qs}` : WANTED_VEHICLE_PATH;
}

export function wantedVehicleReturnTo(params: WantedVehicleQuery) {
  const search = new URLSearchParams();
  for (const key of STOCK_FILTER_KEYS) {
    const value = params[key]?.trim();
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/estoque?${qs}` : "/estoque";
}

export function wantedVehicleFormCopy(params: WantedVehicleQuery) {
  const filtered = STOCK_FILTER_KEYS.some((key) => Boolean(params[key]?.trim()));
  const waitlistQuery = formatStockWaitlistQuery(params);
  const empty = params.sem === "1";

  return {
    filtered,
    waitlistQuery,
    contextLabel: filtered ? waitlistQuery : "",
    pagePath: wantedVehicleReturnTo(params),
    initialModel: params.q?.trim() || params.model?.trim() || "",
    initialYearMin: params.minYear?.trim() ?? "",
    initialYearMax: params.maxYear?.trim() ?? "",
    initialPriceMin: params.minPrice?.trim() ?? "",
    initialPriceMax: params.maxPrice?.trim() ?? "",
    initialKmMax: params.maxKm?.trim() ?? "",
    description: empty
      ? filtered && waitlistQuery
        ? `Não tem ${waitlistQuery} agora. Deixa o modelo e seu contato — a loja guarda o pedido.`
        : "Deixa o modelo que você procura. A loja guarda o pedido e te chama quando aparecer."
      : "Se o modelo não está na lista, deixa o que você procura. A loja guarda o pedido.",
  };
}
