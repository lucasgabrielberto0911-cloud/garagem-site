"use server";

import { lockCustomerIdentity } from "@/lib/admin-customer-lock";
import { recordAdminAudit } from "@/lib/admin-audit";
import { parseMoneyBR } from "@/lib/admin-money";
import { businessDay } from "@/lib/admin-date";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { isValidPlate, normalizePlate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { privateMasterRefForPublicUrl, privatePreviousRefForPublicUrl } from "@/lib/photo-master";
import { deleteUnusedAdminFiles } from "@/lib/admin-file-references";
import { revalidatePublicStock } from "@/lib/public-stock-revalidate";

export type SaleActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

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

  if (customerPhone) {
    await lockCustomerIdentity(tx, customerPhone);
    const existing = await tx.customer.findFirst({
      where: { phone: customerPhone },
    });
    if (existing) throw new Error("DUPLICATE_CUSTOMER");
  }
  return (
    await tx.customer.create({
      data: {
        name: customerName || "Não informado",
        phone: customerPhone || "",
      },
    })
  ).id;
}

type ParsedSaleForm = {
  isHistorical: boolean;
  vehicleId: string;
  brand: string;
  model: string;
  plate: string;
  yearModel: number | undefined;
  customerId: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: string;
  notes: string | null;
  salePrice: number;
  saleDate: Date;
  fieldErrors: Record<string, string>;
};

function parseSaleForm(formData: FormData): ParsedSaleForm {
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
  const salePrice = parseMoneyBR(formData.get("salePrice")) ?? 0;
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
      (!Number.isInteger(yearModel) ||
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

  const paymentMethod = paymentMethodRaw || (isHistorical ? "Histórico" : "");
  if (!paymentMethod) {
    fieldErrors.paymentMethod = "Escolha a forma de pagamento.";
  }

  const saleDate = saleDateRaw ? businessDay(saleDateRaw) : new Date();
  if (Number.isNaN(saleDate.getTime())) {
    fieldErrors.saleDate = "Data inválida.";
  }

  return {
    isHistorical,
    vehicleId,
    brand,
    model,
    plate,
    yearModel,
    customerId,
    customerName,
    customerPhone,
    paymentMethod,
    notes,
    salePrice,
    saleDate,
    fieldErrors,
  };
}

async function revalidateSales(vehicleId?: string) {
  revalidatePath("/admin/vendas");
  revalidatePath("/admin/veiculos");
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  await revalidatePublicStock(vehicleId);
}

export async function createSale(formData: FormData): Promise<SaleActionState> {
  const session = await requireAdmin();

  const parsed = parseSaleForm(formData);
  const {
    isHistorical,
    vehicleId,
    brand,
    model,
    plate,
    yearModel,
    customerId,
    customerName,
    customerPhone,
    paymentMethod,
    notes,
    salePrice,
    saleDate,
    fieldErrors,
  } = parsed;

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

        const registered = await tx.sale.create({
          data: {
            vehicleId: vehicle.id,
            customerId: finalCustomerId,
            salePrice,
            paymentMethod,
            saleDate,
            notes,
          },
        });
        await recordAdminAudit(
          tx,
          session.adminId,
          registered.id,
          "sale.create",
          { salePrice: registered.salePrice, vehicleId: registered.vehicleId },
        );
      });
    } else {
      const existingSale = await prisma.sale.findUnique({
        where: { vehicleId },
      });
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

        const registered = await tx.sale.create({
          data: {
            vehicleId,
            customerId: finalCustomerId,
            salePrice,
            paymentMethod,
            saleDate,
            notes,
          },
        });
        await recordAdminAudit(
          tx,
          session.adminId,
          registered.id,
          "sale.create",
          { salePrice: registered.salePrice, vehicleId: registered.vehicleId },
        );

        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { status: "vendido", featured: false },
        });
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_CUSTOMER")
      return {
        ok: false,
        message:
          "Já existe cliente com esse telefone. Escolha o cadastro no campo Cliente antes de registrar.",
        fieldErrors: { customerPhone: "Cliente já cadastrado." },
      };
    console.error(error);
    return { ok: false, message: "Não foi possível registrar a venda." };
  }

  await revalidateSales(createdVehicleId);
  return { ok: true, message: "Venda registrada." };
}

export async function updateSale(formData: FormData): Promise<SaleActionState> {
  const session = await requireAdmin();

  const saleId = String(formData.get("saleId") || "").trim();
  if (!saleId) return { ok: false, message: "Venda não encontrada." };

  const parsed = parseSaleForm(formData);
  const {
    isHistorical,
    vehicleId,
    brand,
    model,
    plate,
    yearModel,
    customerId,
    customerName,
    customerPhone,
    paymentMethod,
    notes,
    salePrice,
    saleDate,
    fieldErrors,
  } = parsed;

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Corrija os campos destacados.", fieldErrors };
  }

  const existing = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { vehicle: { select: { id: true, historical: true } } },
  });
  if (!existing) return { ok: false, message: "Venda não encontrada." };

  if (existing.vehicle.historical !== isHistorical) {
    return {
      ok: false,
      message: "Não é possível mudar o tipo da venda (estoque / histórica).",
    };
  }

  const expectedUpdatedAt = String(formData.get("expectedUpdatedAt") || "");
  if (
    !expectedUpdatedAt ||
    expectedUpdatedAt !== existing.updatedAt.toISOString()
  )
    return {
      ok: false,
      message:
        "Esta venda mudou em outro acesso. Seus campos foram mantidos; recarregue e confira antes de salvar.",
    };
  try {
    await prisma.$transaction(async (tx) => {
      const finalCustomerId = await resolveCustomerId(tx, {
        customerId,
        customerName,
        customerPhone,
      });

      if (isHistorical) {
        const resolvedYear =
          yearModel && Number.isFinite(yearModel)
            ? Math.round(yearModel)
            : existing.saleDate.getFullYear();

        await tx.vehicle.update({
          where: { id: existing.vehicleId },
          data: {
            brand,
            model,
            plate,
            year: resolvedYear,
            yearModel: resolvedYear,
            price: salePrice,
          },
        });

        await tx.sale.update({
          where: { id: saleId, updatedAt: existing.updatedAt },
          data: {
            customerId: finalCustomerId,
            salePrice,
            paymentMethod,
            saleDate,
            notes,
          },
        });
        await recordAdminAudit(tx, session.adminId, saleId, "sale.update", {
          salePrice: { before: existing.salePrice, after: salePrice },
          vehicleId: existing.vehicleId,
        });
        return;
      }

      const nextVehicleId = vehicleId || existing.vehicleId;
      if (nextVehicleId !== existing.vehicleId) {
        const otherSale = await tx.sale.findUnique({
          where: { vehicleId: nextVehicleId },
        });
        if (otherSale && otherSale.id !== saleId) {
          throw new Error("VEHICLE_ALREADY_SOLD");
        }

        await tx.vehicle.update({
          where: { id: existing.vehicleId },
          data: { status: "disponivel" },
        });
        await tx.vehicle.update({
          where: { id: nextVehicleId },
          data: { status: "vendido", featured: false },
        });
      }

      await tx.sale.update({
        where: { id: saleId, updatedAt: existing.updatedAt },
        data: {
          vehicleId: nextVehicleId,
          customerId: finalCustomerId,
          salePrice,
          paymentMethod,
          saleDate,
          notes,
        },
      });
      await recordAdminAudit(tx, session.adminId, saleId, "sale.update", {
        salePrice: { before: existing.salePrice, after: salePrice },
        vehicleId: nextVehicleId,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_CUSTOMER")
      return {
        ok: false,
        message:
          "Já existe cliente com esse telefone. Escolha o cadastro no campo Cliente.",
        fieldErrors: { customerPhone: "Cliente já cadastrado." },
      };
    if (error instanceof Error && error.message === "VEHICLE_ALREADY_SOLD") {
      return {
        ok: false,
        message: "Este veículo já tem uma venda registrada.",
        fieldErrors: { vehicleId: "Este veículo já tem uma venda registrada." },
      };
    }
    console.error(error);
    return { ok: false, message: "Não foi possível atualizar a venda." };
  }

  await revalidateSales(existing.vehicleId);
  if (!isHistorical && vehicleId && vehicleId !== existing.vehicleId) {
    await revalidatePublicStock(vehicleId);
  }
  return { ok: true, message: "Venda atualizada." };
}

/**
 * Cancelar a venda: veículo do estoque volta a disponível; registro histórico
 * é removido junto com o veículo stub (não entra na vitrine).
 */
export async function deleteSale(
  id: string,
  expectedUpdatedAt: string,
): Promise<SaleActionState> {
  const session = await requireAdmin();

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { vehicle: { select: { id: true, historical: true } } },
  });
  if (!sale) return { ok: false, message: "Venda não encontrada." };
  if (expectedUpdatedAt !== sale.updatedAt.toISOString())
    return {
      ok: false,
      message:
        "Esta venda foi alterada em outra tela. Recarregue e confira antes de cancelar.",
    };

  try {
    if (sale.vehicle.historical) {
      const files = await prisma.vehicle.findUnique({
        where: { id: sale.vehicleId },
        include: {
          photos: { select: { url: true } },
          costs: { select: { receiptUrl: true } },
          documents: { select: { fileUrl: true } },
        },
      });
      await prisma.$transaction(async (tx) => {
        await tx.sale.delete({ where: { id, updatedAt: sale.updatedAt } });
        await tx.vehicle.delete({ where: { id: sale.vehicleId } });
        await recordAdminAudit(tx, session.adminId, id, "sale.cancel", {
          vehicleId: sale.vehicleId,
          salePrice: sale.salePrice,
          historical: true,
        });
      });
      await deleteUnusedAdminFiles([
        ...(files?.photos.flatMap((photo) => [
          photo.url,
          privateMasterRefForPublicUrl(photo.url),
          privatePreviousRefForPublicUrl(photo.url),
        ]) ?? []),
        ...(files?.costs.map((cost) => cost.receiptUrl) ?? []),
        ...(files?.documents.map((doc) => doc.fileUrl) ?? []),
      ]);
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.sale.delete({ where: { id, updatedAt: sale.updatedAt } });
        await tx.vehicle.update({
          where: { id: sale.vehicleId },
          data: { status: "disponivel" },
        });
        await recordAdminAudit(tx, session.adminId, id, "sale.cancel", {
          vehicleId: sale.vehicleId,
          salePrice: sale.salePrice,
          historical: false,
        });
      });
    }
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Não foi possível cancelar a venda." };
  }

  await revalidateSales(sale.vehicleId);
  return {
    ok: true,
    message: sale.vehicle.historical
      ? "Venda histórica removida."
      : "Venda cancelada e veículo devolvido ao estoque.",
  };
}
