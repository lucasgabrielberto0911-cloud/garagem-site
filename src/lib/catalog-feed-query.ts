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

/**
 * Roda a consulta do feed. Se o banco ainda não tem `locationCity`,
 * `historical` ou `consigned` (P2022), tira só aquela coluna e tenta de novo.
 * Sem a coluna `consigned` não existe consignado no banco, então nada vaza.
 */
export async function queryCatalogVehicles<T>(
  find: (where: CatalogWhere, legacy: boolean) => Promise<T[]>,
): Promise<T[]> {
  const where: CatalogWhere = {
    status: "disponivel",
    historical: false,
    consigned: false,
  };
  let legacy = false;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await find({ ...where }, legacy);
    } catch (error) {
      if (attempt >= 3) throw error;
      if (!legacy && isMissingColumnError(error, "locationCity")) {
        legacy = true;
      } else if (where.historical === false && isMissingColumnError(error, "historical")) {
        delete where.historical;
      } else if (where.consigned === false && isMissingColumnError(error, "consigned")) {
        delete where.consigned;
      } else {
        throw error;
      }
    }
  }
}
