import type { Prisma } from "@prisma/client";
export async function recordAdminAudit(
  tx: Prisma.TransactionClient,
  adminId: string,
  entityId: string,
  action: string,
  changes: Prisma.InputJsonObject,
) {
  await tx.adminAudit.create({ data: { adminId, entityId, action, changes } });
}
