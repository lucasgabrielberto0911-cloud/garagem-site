import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "./prisma-errors";

const CUSTOMER_SELECT = {
  id: true, name: true, phone: true, cpf: true, email: true,
  address: true, notes: true, createdAt: true,
} as const;

/** A listagem continua disponível durante a implantação; edição exige versão. */
export async function listAdminCustomers(args: {
  where: Prisma.CustomerWhereInput; skip: number; take: number;
}) {
  const query = { ...args, orderBy: { createdAt: "desc" as const } };
  try {
    return await prisma.customer.findMany({ ...query, select: { ...CUSTOMER_SELECT, updatedAt: true } });
  } catch (error) {
    if (!isMissingColumnError(error, "updatedAt")) throw error;
    const rows = await prisma.customer.findMany({ ...query, select: CUSTOMER_SELECT });
    return rows.map(row => ({ ...row, updatedAt: null }));
  }
}
