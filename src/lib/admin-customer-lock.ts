import type { Prisma } from "@prisma/client";

export async function lockCustomerIdentity(
  tx: Prisma.TransactionClient,
  phone: string,
  cpf?: string | null,
) {
  const keys = [
    phone ? `customer:${phone}` : "",
    cpf ? `customer-cpf:${cpf}` : "",
  ]
    .filter(Boolean)
    .sort();
  for (const key of keys)
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
}
