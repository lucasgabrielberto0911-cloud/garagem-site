import {
  CATALOG_IMAGE_SLOTS,
  catalogFeedImageUrl,
  catalogVehicleRow,
  type CatalogFeedVehicle,
} from "@/lib/catalog-feed";
import { CATALOG_FEED_WHERE } from "@/lib/catalog-feed-query";
import { site } from "@/lib/site";

/** Rota pública principal do feed CSV lida pelo Commerce Manager da Meta. */
export const CATALOG_FEED_PATH = "/api/meta/catalog.csv";

export function catalogFeedUrl(origin: string = site.url): string {
  return new URL(CATALOG_FEED_PATH, origin).toString();
}

export type CatalogStatusVehicle = CatalogFeedVehicle & {
  status: string;
  historical?: boolean | null;
  consigned?: boolean | null;
};

export type CatalogVehicleStatus = {
  inCatalog: boolean;
  reasons: string[];
  feedImageCount: number;
};

/**
 * Classifica se um veículo entra no feed do catálogo da Meta e lista os motivos
 * objetivos de descarte reutilizando exatamente as mesmas regras de
 * `catalog-feed-query.ts` (`CATALOG_FEED_WHERE`) e `catalog-feed.ts`
 * (`catalogFeedImageUrl` / `catalogVehicleRow`).
 *
 * Consignado nunca entra — sem exceção.
 */
export function catalogStatusFor(
  vehicle: CatalogStatusVehicle,
  origin: string = site.url,
): CatalogVehicleStatus {
  const reasons: string[] = [];

  if (vehicle.consigned === true) {
    reasons.push("Consignado (nunca entra)");
  }

  if (vehicle.historical === true) {
    reasons.push("Histórico");
  }

  if (vehicle.status === "reservado") {
    reasons.push("Reservado");
  } else if (vehicle.status === "vendido") {
    reasons.push("Vendido");
  } else if (vehicle.status !== CATALOG_FEED_WHERE.status) {
    reasons.push("Indisponível");
  }

  if (!Number.isFinite(vehicle.price) || vehicle.price <= 0) {
    reasons.push("Sem preço");
  }

  const feedImageCount = vehicle.photos
    .map((photo) => catalogFeedImageUrl(origin, vehicle.id, photo))
    .filter(Boolean)
    .slice(0, CATALOG_IMAGE_SLOTS).length;

  if (vehicle.photos.length === 0) {
    reasons.push("Sem foto");
  } else if (feedImageCount === 0) {
    reasons.push("Sem foto pública");
  } else if (catalogVehicleRow(vehicle, origin) === null) {
    reasons.push("Descartado pelo feed");
  }

  return {
    inCatalog: reasons.length === 0,
    reasons,
    feedImageCount,
  };
}
