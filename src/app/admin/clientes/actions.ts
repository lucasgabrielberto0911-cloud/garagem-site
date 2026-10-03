"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { lockCustomerIdentity } from "@/lib/admin-customer-lock";
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
  const phone = String(formData.get("phone") || "").replace(/\D/g, "");
  const cpf = String(formData.get("cpf") || "").replace(/\D/g, "") || null;
  const email = String(formData.get("email") || "").trim() || null;
  const address = String(formData.get("address") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Informe o nome do cliente.";
  if (phone.length < 10) fieldErrors.phone = "Telefone incompleto.";
  if (email && !email.includes("@")) fieldErrors.email = "E-mail inválido.";
  if (cpf && cpf.length !== 11) fieldErrors.cpf = "CPF deve ter 11 dígitos.";

  return { data: { name, phone, cpf, email, address, notes }, fieldErrors };
}

export async function saveCustomer(
  formData: FormData,
): Promise<CustomerActionState> {
  await requireAdmin();

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
      });
      if (duplicate) throw new Error("DUPLICATE_CUSTOMER");
      if (id) await tx.customer.update({ where: { id }, data });
      else await tx.customer.create({ data });
    });
  } catch (error) {
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
  await requireAdmin();

  const sales = await prisma.sale.count({ where: { customerId: id } });
  if (sales > 0) {
    return {
      ok: false,
      message:
        "Este cliente tem vendas registradas. Cancele as vendas antes de excluí-lo.",
    };
  }

  await prisma.customer.delete({ where: { id } });
  revalidatePath("/admin/clientes");
  return { ok: true, message: "Cliente excluído." };
}
