"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VEHICLES_PUBLIC_CACHE_TAG } from "@/lib/vehicles";

export type SaleActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

function revalidatePublicStock(vehicleId?: string) {
  revalidateTag(VEHICLES_PUBLIC_CACHE_TAG);
  revalidatePath("/");
  revalidatePath("/estoque");
  revalidatePath("/estoque/[id]", "page");
  if (vehicleId) revalidatePath(`/estoque/${vehicleId}`);
}

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

function digitsOnly(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "");
}

export async function createSale(formData: FormData): Promise<SaleActionState> {
  await requireAdmin();

  const vehicleId = String(formData.get("vehicleId") || "").trim();
  const customerId = String(formData.get("customerId") || "").trim();
  const customerName = String(formData.get("customerName") || "").trim();
  const customerPhone = digitsOnly(formData.get("customerPhone"));
  const paymentMethod = String(formData.get("paymentMethod") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || null;
  const salePrice = Number(digitsOnly(formData.get("salePrice")));
  const saleDateRaw = String(formData.get("saleDate") || "").trim();

  const fieldErrors: Record<string, string> = {};

  if (!vehicleId) fieldErrors.vehicleId = "Escolha o veículo vendido.";
  if (!paymentMethod) fieldErrors.paymentMethod = "Escolha a forma de pagamento.";
  if (!salePrice || salePrice <= 0) fieldErrors.salePrice = "Informe o valor da venda.";

  const isNewCustomer = customerId === "" || customerId === "novo";
  if (isNewCustomer) {
    if (!customerName) fieldErrors.customerName = "Informe o nome do cliente.";
    if (customerPhone.length < 10) {
      fieldErrors.customerPhone = "Telefone incompleto.";
    }
  }

  const saleDate = saleDateRaw ? new Date(`${saleDateRaw}T12:00:00`) : new Date();
  if (Number.isNaN(saleDate.getTime())) {
    fieldErrors.saleDate = "Data inválida.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Corrija os campos destacados.", fieldErrors };
  }

  const existingSale = await prisma.sale.findUnique({ where: { vehicleId } });
  if (existingSale) {
    return {
      ok: false,
      message: "Este veículo já tem uma venda registrada.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const finalCustomerId = isNewCustomer
        ? (
            await tx.customer.create({
              data: { name: customerName, phone: customerPhone },
            })
          ).id
        : customerId;

      await tx.sale.create({
        data: {
          vehicleId,
          customerId: finalCustomerId,
          salePrice,
          paymentMethod,
          saleDate,
          notes,
        },
      });

      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { status: "vendido" },
      });
    });
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Não foi possível registrar a venda." };
  }

  revalidatePath("/admin/vendas");
  revalidatePath("/admin/veiculos");
  revalidatePath("/admin");
  revalidatePublicStock(vehicleId);
  return { ok: true, message: "Venda registrada." };
}

/**
 * Cancelar a venda devolve o veículo ao estoque como disponível — é o caminho
 * usado quando o registro foi feito por engano.
 */
export async function deleteSale(id: string): Promise<SaleActionState> {
  await requireAdmin();

  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) return { ok: false, message: "Venda não encontrada." };

  await prisma.$transaction([
    prisma.sale.delete({ where: { id } }),
    prisma.vehicle.update({
      where: { id: sale.vehicleId },
      data: { status: "disponivel" },
    }),
  ]);

  revalidatePath("/admin/vendas");
  revalidatePath("/admin/veiculos");
  revalidatePath("/admin");
  revalidatePublicStock(sale.vehicleId);
  return { ok: true, message: "Venda cancelada e veículo devolvido ao estoque." };
}
