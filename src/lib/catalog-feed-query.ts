import { isMissingColumnError } from "@/lib/prisma-errors";

/**
 * Filtro do feed da Meta: só estoque PRÓPRIO e disponível.
 * Consignado nunca entra (decisão do Lucas, 15/11/2026): não há parâmetro
 * de URL que reative isso. `?consigned=` é ignorado.
 */
export type CatalogWhere = {
  status: "disponivel";
  historical?: false;
  consigned?: false;
};

export const CATALOG_FEED_WHERE = {
  status: "disponivel",
  historical: false,
  consigned: false,
} as const;

export type CatalogColumnFlags = {
  locationCity: boolean;
  historical: boolean;
  consigned: boolean;
};

/**
 * Executa consulta tolerando bancos sem as colunas mais recentes (`locationCity`,
 * `historical` ou `consigned` — erro P2022), removendo apenas a coluna ausente.
 */
export async function withCatalogColumnFallback<T>(
  run: (columns: CatalogColumnFlags) => Promise<T>,
): Promise<T> {
  const columns: CatalogColumnFlags = {
    locationCity: true,
    historical: true,
    consigned: true,
  };
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run({ ...columns });
    } catch (error) {
      if (attempt >= 3) throw error;
      if (columns.locationCity && isMissingColumnError(error, "locationCity")) {
        columns.locationCity = false;
      } else if (columns.historical && isMissingColumnError(error, "historical")) {
        columns.historical = false;
      } else if (columns.consigned && isMissingColumnError(error, "consigned")) {
        columns.consigned = false;
      } else {
        throw error;
      }
    }
  }
}

/**
 * Consulta o estoque elegível para o feed tolerando bancos ainda sem `locationCity`,
 * `historical` ou `consigned` (P2022), tira só aquela coluna e tenta de novo.
 * Sem a coluna `consigned` não existe consignado no banco, então nada vaza.
 */
export async function queryCatalogVehicles<T>(
  find: (where: CatalogWhere, legacy: boolean) => Promise<T[]>,
): Promise<T[]> {
  return withCatalogColumnFallback((columns) => {
    const where: CatalogWhere = { status: CATALOG_FEED_WHERE.status };
    if (columns.historical) where.historical = CATALOG_FEED_WHERE.historical;
    if (columns.consigned) where.consigned = CATALOG_FEED_WHERE.consigned;
    return find(where, !columns.locationCity);
  });
}
