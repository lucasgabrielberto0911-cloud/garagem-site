"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { isValidPlate, normalizePlate } from "@/lib/format";
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

async function resolveCustomerId(
  tx: Prisma.TransactionClient,
  {
    customerId,
    customerName,
    customerPhone,
  }: {
    customerId: string;
    customerName: string;
    customerPhone: string;
  },
) {
  const isNewCustomer = customerId === "" || customerId === "novo";
  if (!isNewCustomer) return customerId;

  if (!customerName && customerPhone.length < 10) return null;

  return (
    await tx.customer.create({
      data: {
        name: customerName || "Não informado",
        phone: customerPhone || "",
      },
    })
  ).id;
}

export async function createSale(formData: FormData): Promise<SaleActionState> {
  await requireAdmin();

  const source = String(formData.get("source") || "estoque").trim();
  const isHistorical = source === "historica";

  const vehicleId = String(formData.get("vehicleId") || "").trim();
  const brand = String(formData.get("brand") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const plateRaw = String(formData.get("plate") || "").trim();
  const plate = plateRaw ? normalizePlate(plateRaw) : "";
  const yearRaw = String(formData.get("yearModel") || "").trim();
  const yearModel = yearRaw ? Number(yearRaw) : undefined;

  const customerId = String(formData.get("customerId") || "").trim();
  const customerName = String(formData.get("customerName") || "").trim();
  const customerPhone = digitsOnly(formData.get("customerPhone"));
  const paymentMethodRaw = String(formData.get("paymentMethod") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || null;
  const salePrice = Number(digitsOnly(formData.get("salePrice")));
  const saleDateRaw = String(formData.get("saleDate") || "").trim();

  const fieldErrors: Record<string, string> = {};

  if (!salePrice || salePrice <= 0) {
    fieldErrors.salePrice = "Informe o valor da venda.";
  }

  if (isHistorical) {
    if (!brand) fieldErrors.brand = "Informe a marca.";
    if (!model) fieldErrors.model = "Informe o modelo.";
    if (!plate || !isValidPlate(plate)) {
      fieldErrors.plate = "Informe a placa completa (ABC1D23 ou ABC-1234).";
    }
    if (
      yearModel !== undefined &&
      (!Number.isFinite(yearModel) ||
        yearModel < 1950 ||
        yearModel > new Date().getFullYear() + 1)
    ) {
      fieldErrors.yearModel = "Ano inválido.";
    }
  } else if (!vehicleId) {
    fieldErrors.vehicleId = "Escolha o veículo vendido.";
  }

  const isNewCustomer = customerId === "" || customerId === "novo";
  if (isNewCustomer && customerPhone && customerPhone.length < 10) {
    fieldErrors.customerPhone = "Telefone incompleto.";
  }

  const paymentMethod =
    paymentMethodRaw || (isHistorical ? "Histórico" : "");
  if (!paymentMethod) {
    fieldErrors.paymentMethod = "Escolha a forma de pagamento.";
  }

  const saleDate = saleDateRaw ? new Date(`${saleDateRaw}T12:00:00`) : new Date();
  if (Number.isNaN(saleDate.getTime())) {
    fieldErrors.saleDate = "Data inválida.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Corrija os campos destacados.", fieldErrors };
  }

  let createdVehicleId = vehicleId;

  try {
    if (isHistorical) {
      const resolvedYear =
        yearModel && Number.isFinite(yearModel)
          ? Math.round(yearModel)
          : saleDate.getFullYear();

      await prisma.$transaction(async (tx) => {
        const vehicle = await tx.vehicle.create({
          data: {
            brand,
            model,
            year: resolvedYear,
            yearModel: resolvedYear,
            km: 0,
            price: salePrice,
            plate,
            fuel: "Não informado",
            transmission: "Não informado",
            status: "vendido",
            historical: true,
            featured: false,
            description:
              "Registro histórico de venda (veículo fora do estoque do site).",
          },
        });

        createdVehicleId = vehicle.id;

        const finalCustomerId = await resolveCustomerId(tx, {
          customerId,
          customerName,
          customerPhone,
        });

        await tx.sale.create({
          data: {
            vehicleId: vehicle.id,
            customerId: finalCustomerId,
            salePrice,
            paymentMethod,
            saleDate,
            notes,
          },
        });
      });
    } else {
      const existingSale = await prisma.sale.findUnique({ where: { vehicleId } });
      if (existingSale) {
        return {
          ok: false,
          message: "Este veículo já tem uma venda registrada.",
        };
      }

      await prisma.$transaction(async (tx) => {
        const finalCustomerId = await resolveCustomerId(tx, {
          customerId,
          customerName,
          customerPhone,
        });

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
    }
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Não foi possível registrar a venda." };
  }

  revalidatePath("/admin/vendas");
  revalidatePath("/admin/veiculos");
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  revalidatePublicStock(createdVehicleId);
  return { ok: true, message: "Venda registrada." };
}

/**
 * Cancelar a venda: veículo do estoque volta a disponível; registro histórico
 * é removido junto com o veículo stub (não entra na vitrine).
 */
export async function deleteSale(id: string): Promise<SaleActionState> {
  await requireAdmin();

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { vehicle: { select: { id: true, historical: true } } },
  });
  if (!sale) return { ok: false, message: "Venda não encontrada." };

  try {
    if (sale.vehicle.historical) {
      await prisma.$transaction([
        prisma.sale.delete({ where: { id } }),
        prisma.vehicle.delete({ where: { id: sale.vehicleId } }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.sale.delete({ where: { id } }),
        prisma.vehicle.update({
          where: { id: sale.vehicleId },
          data: { status: "disponivel" },
        }),
      ]);
    }
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Não foi possível cancelar a venda." };
  }

  revalidatePath("/admin/vendas");
  revalidatePath("/admin/veiculos");
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  revalidatePublicStock(sale.vehicleId);
  return {
    ok: true,
    message: sale.vehicle.historical
      ? "Venda histórica removida."
      : "Venda cancelada e veículo devolvido ao estoque.",
  };
}
