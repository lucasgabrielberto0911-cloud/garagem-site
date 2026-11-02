"use server";

import { normalizeAdminPhone } from "@/lib/admin-phone";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { recordAdminAudit } from "@/lib/admin-audit";
import { isValidCpf } from "@/lib/format";
import { lockCustomerIdentity } from "@/lib/admin-customer-lock";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";

export type CustomerActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

function parseCustomer(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const phone = normalizeAdminPhone(String(formData.get("phone") || "")) ?? "";
  const cpf = String(formData.get("cpf") || "").replace(/\D/g, "") || null;
  const email = String(formData.get("email") || "").trim() || null;
  const address = String(formData.get("address") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Informe o nome do cliente.";
  if (!phone) fieldErrors.phone = "Telefone incompleto.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "E-mail inválido.";
  if (cpf && !isValidCpf(cpf)) fieldErrors.cpf = "CPF inválido. Confira os 11 dígitos.";

  for (const [key, value, max] of [["name", name, 120], ["email", email, 254], ["address", address, 240], ["notes", notes, 3000]] as const) {
    if (value && value.length > max) fieldErrors[key] = `Use até ${max} caracteres.`;
  }
  return { data: { name, phone, cpf, email, address, notes }, fieldErrors };
}

export async function saveCustomer(
  formData: FormData,
): Promise<CustomerActionState> {
  const session = await requireAdmin();

  const id = String(formData.get("id") || "").trim();
  const { data, fieldErrors } = parseCustomer(formData);

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Corrija os campos destacados.", fieldErrors };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await lockCustomerIdentity(tx, data.phone, data.cpf);
      const duplicate = await tx.customer.findFirst({
        where: {
          id: { not: id || "" },
          OR: [{ phone: data.phone }, ...(data.cpf ? [{ cpf: data.cpf }] : [])],
        },
        select: { id: true },
      });
      if (duplicate) throw new Error("DUPLICATE_CUSTOMER");
      if (id) {
        const expected = String(formData.get("expectedUpdatedAt") ?? "");
        if (!expected) throw new Error("CUSTOMER_VERSION_UNAVAILABLE");
        if (Number.isNaN(Date.parse(expected))) throw new Error("CUSTOMER_CONFLICT");
        const saved = await tx.customer.updateMany({ where: { id, updatedAt: new Date(expected) }, data: { ...data, updatedAt: new Date(Math.max(Date.now(), Date.parse(expected) + 1)) } });
        if (saved.count !== 1) throw new Error("CUSTOMER_CONFLICT");
        await recordAdminAudit(tx, session.adminId, id, "customer.update", { fields: Object.keys(data) });
      } else {
        const saved = await tx.customer.create({ data, select: { id: true } });
        await recordAdminAudit(tx, session.adminId, saved.id, "customer.create", { fields: Object.keys(data) });
      }
    });
  } catch (error) {
    if (isMissingColumnError(error, "updatedAt") || (error instanceof Error && error.message === "CUSTOMER_VERSION_UNAVAILABLE")) return { ok: false, message: "Cadastro temporariamente em modo de consulta. A atualização do banco está pendente; seu preenchimento foi mantido. Tente salvar após a atualização." };
    if (error instanceof Error && error.message === "CUSTOMER_CONFLICT") return { ok: false, message: "Este cadastro mudou em outra sessão. Seu preenchimento foi mantido. Reabra o cadastro para conferir antes de salvar." };
    if (error instanceof Error && error.message === "DUPLICATE_CUSTOMER")
      return {
        ok: false,
        message:
          "Já existe cliente com esse telefone ou CPF. Abra o cadastro existente para conferir, sem duplicar.",
        fieldErrors: { phone: "Telefone ou CPF já cadastrado." },
      };
    console.error(error);
    return { ok: false, message: "Não foi possível salvar o cliente." };
  }

  revalidatePath("/admin/clientes");
  return {
    ok: true,
    message: id ? "Cliente atualizado." : "Cliente cadastrado.",
  };
}

export async function deleteCustomer(id: string): Promise<CustomerActionState> {
  const session = await requireAdmin();

  const [sales, reservations] = await Promise.all([
    prisma.sale.count({ where: { customerId: id } }),
    prisma.vehicleReservation.count({ where: { customerId: id } }),
  ]);
  if (sales > 0) {
    return {
      ok: false,
      message:
        "Este cliente tem vendas registradas. Cancele as vendas antes de excluí-lo.",
    };
  }
  if (reservations > 0) {
    return {
      ok: false,
      message: "Este cliente tem reservas registradas e não pode ser excluído.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.customer.delete({ where: { id }, select: { id: true } });
      await recordAdminAudit(tx, session.adminId, id, "customer.delete", {});
    });
  } catch (error) {
    console.error("[admin/clientes] falha ao excluir cliente:", error);
    return { ok: false, message: "Não foi possível excluir o cliente." };
  }
  revalidatePath("/admin/clientes");
  return { ok: true, message: "Cliente excluído." };
}
