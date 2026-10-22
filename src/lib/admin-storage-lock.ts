import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AdminStorageLockOptions = {
  timeout?: number;
  maxWait?: number;
};

/** Une a limpeza e a gravação de referências, inclusive entre duas instâncias. */
export function withAdminStorageLock<T>(
  run: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: AdminStorageLockOptions,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(173821, 1)::text`;
      return run(tx);
    },
    {
      timeout: options?.timeout ?? 15000,
      maxWait: options?.maxWait ?? 5000,
    },
  );
}
