import type { Prisma } from "@prisma/client";

export function normalizeSalesQuery(value?: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
}

/** Aplicado antes da paginação; cada palavra pode corresponder ao carro ou cliente. */
export function salesSearchWhere(value?: string | null): Prisma.SaleWhereInput {
  const query = normalizeSalesQuery(value);
  if (!query) return {};
  return {
    AND: query.split(" ").map(word => {
      const contains = { contains: word, mode: "insensitive" as const };
      const plate = word.replace(/[^a-zA-Z0-9]/g, "");
      return { OR: [
        { customer: { is: { name: contains } } },
        { vehicle: { is: { OR: [
          { brand: contains }, { model: contains }, { version: contains },
          ...(plate ? [{ plate: { contains: plate, mode: "insensitive" as const } }] : []),
        ] } } },
      ] };
    }),
  };
}
