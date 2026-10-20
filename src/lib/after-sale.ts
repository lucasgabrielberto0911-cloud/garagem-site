import type { Prisma } from "@prisma/client";
import { AFTER_SALE } from "./admin-commercial";

export async function scheduleAfterSale(tx: Prisma.TransactionClient, sale: { id: string; saleDate: Date; customerId: string | null }) {
  if (!sale.customerId) {
    await tx.afterSaleTask.deleteMany({ where: { saleId: sale.id, completedAt: null } });
    return;
  }
  await tx.afterSaleTask.createMany({ data: AFTER_SALE.map(({ kind, days }) => ({ saleId: sale.id, kind, dueAt: new Date(sale.saleDate.getTime() + days * 86400000) })), skipDuplicates: true });
  for (const { kind, days } of AFTER_SALE) await tx.afterSaleTask.updateMany({ where: { saleId: sale.id, kind, completedAt: null }, data: { dueAt: new Date(sale.saleDate.getTime() + days * 86400000) } });
}
