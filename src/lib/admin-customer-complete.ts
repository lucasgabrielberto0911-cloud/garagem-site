import type { Prisma } from "@prisma/client";
import { lockCustomerIdentity } from "@/lib/admin-customer-lock";

export type CompleteCustomerResult =
  | { ok: true; cpf: string | null; address: string | null }
  | { ok: false; message: string };

const BLANK = (field: "cpf" | "address") => ({ OR: [{ [field]: null }, { [field]: "" }] });

/** Preenche CPF/endereço em branco sob trava do CPF; nunca sobrescreve dado já gravado. Chamar dentro de $transaction. */
export async function completeCustomerFields(
  tx: Prisma.TransactionClient,
  customerId: string,
  cpf: string,
  address: string,
): Promise<CompleteCustomerResult> {
  const found = await tx.customer.findUnique({ where: { id: customerId }, select: { phone: true } });
  if (!found) return { ok: false, message: "Cliente não encontrado." };
  await lockCustomerIdentity(tx, found.phone, cpf);
  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { ok: false, message: "Cliente não encontrado." };
  let changed = 0;
  if (cpf && !customer.cpf) {
    const duplicate = await tx.customer.findFirst({ where: { cpf, id: { not: customerId } }, select: { id: true } });
    if (duplicate) return { ok: false, message: "Esse CPF já pertence a outro cliente." };
    changed += (await tx.customer.updateMany({ where: { id: customerId, ...BLANK("cpf") }, data: { cpf } })).count;
  }
  if (address && !customer.address) {
    changed += (await tx.customer.updateMany({ where: { id: customerId, ...BLANK("address") }, data: { address } })).count;
  }
  if (!changed) return { ok: false, message: "Informe CPF ou endereço que ainda esteja em branco." };
  const updated = await tx.customer.findUniqueOrThrow({ where: { id: customerId }, select: { cpf: true, address: true } });
  return { ok: true, cpf: updated.cpf, address: updated.address };
}
