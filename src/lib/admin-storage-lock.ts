import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
/** Une a limpeza e a gravação de referências, inclusive entre duas instâncias. */
export function withAdminStorageLock<T>(
  run: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(173821, 1)::text`;
      return run(tx);
    },
    { timeout: 60000, maxWait: 15000 },
  );
}
