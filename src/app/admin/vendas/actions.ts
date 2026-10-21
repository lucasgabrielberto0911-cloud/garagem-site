"use server";

import { scheduleAfterSale } from "@/lib/after-sale";
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
import { formatSaleNotes } from "@/lib/sales-goals";
import { parseContractPaymentsJson, parseVehicleCustomerIds, signalExceedsTotal, signalMismatch, summarizeContractPayments, sumContractPayments } from "@/lib/admin-commercial";
import { isValidCpf } from "@/lib/format";

export type SaleActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

type SaleFlowPayload = { vehicleId?: string; total?: number; payments?: unknown; customerId?: string; customerName?: string; customerPhone?: string; seller?: string; commission?: number | null; signal?: boolean; signalAmount?: number; chassis?: string; renavam?: string; cpf?: string; rg?: string; address?: string; conditions?: string; includeProposal?: boolean };

export async function finalizeSaleFlow(raw: string): Promise<{ ok: boolean; message: string; saleId?: string; contractId?: string; receiptId?: string; proposalId?: string }> {
  const session = await requireAdmin();
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return { ok: false, message: "Dados da venda inválidos." }; }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, message: "Dados da venda inválidos." };
  const input = payload as SaleFlowPayload;
  const vehicleId = typeof input.vehicleId === "string" ? input.vehicleId : "";
  const rawTotal = Number(input.total);
  const total = Math.round(rawTotal * 100) / 100;
  const paymentsRaw = JSON.stringify(input.payments ?? []);
  const parsedPayments = (() => { try { return parseContractPaymentsJson(paymentsRaw); } catch { return undefined; } })();
  if (!vehicleId || !Number.isFinite(rawTotal) || Math.abs(rawTotal - total) > 0.000001 || !Number.isSafeInteger(Math.round(total * 100)) || total <= 0 || !parsedPayments?.length || Math.abs(sumContractPayments(parsedPayments) - total) > 0.001) return { ok: false, message: "A soma dos pagamentos deve ser igual ao valor negociado." };
  const payments = parsedPayments;
  if (new Set(payments.map((payment) => payment.method)).size !== payments.length) return { ok: false, message: "Selecione cada forma de pagamento uma única vez." };
  if (payments.some((payment) => payment.amount <= 0) || payments.some((payment) => payment.method === "financiamento" && !payment.installments) || payments.some((payment) => payment.method === "troca" && (!payment.tradeVehicle?.trim() || !payment.tradePlate?.trim())) || payments.some((payment) => payment.method === "cartao" && !payment.installments)) return { ok: false, message: "Complete os campos da forma de pagamento selecionada." };
  const customerId = typeof input.customerId === "string" ? input.customerId : "";
  const customerName = String(input.customerName ?? "").trim();
  const customerPhone = digitsOnly(input.customerPhone ?? "");
  if (!customerName || customerPhone.length < 10) return { ok: false, message: "Informe nome e telefone válidos do comprador." };
  const sellerName = String(input.seller ?? "").trim();
  const commission = input.commission == null ? null : Number(input.commission);
  if (commission != null && (!Number.isFinite(commission) || commission < 0)) return { ok: false, message: "Comissão inválida." };
  const notes = formatSaleNotes(null, sellerName || null, commission);
  const cpf = String(input.cpf ?? "").replace(/\D/g, "");
  const identifiers = parseVehicleCustomerIds({ chassis: input.chassis, renavam: input.renavam, rg: input.rg });
  if (cpf && !isValidCpf(cpf)) return { ok: false, message: "CPF inválido. Confira os 11 dígitos." };
  if (identifiers.error) return { ok: false, message: identifiers.error };
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${vehicleId} FOR UPDATE`;
      const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId }, include: { sale: true } });
      if (!vehicle || vehicle.historical) throw new Error("VEHICLE_UNAVAILABLE");
      if (vehicle.sale) {
        let sameCustomer = Boolean(customerId && customerId !== "novo" && vehicle.sale.customerId === customerId);
        if (customerId === "novo" && vehicle.sale.customerId) {
          const savedCustomer = await tx.customer.findUnique({ where: { id: vehicle.sale.customerId } });
          sameCustomer = Boolean(savedCustomer && savedCustomer.name === customerName && digitsOnly(savedCustomer.phone) === customerPhone);
        }
        if (Math.round(vehicle.sale.salePrice * 100) !== Math.round(total * 100) || !sameCustomer || vehicle.sale.paymentMethod !== summarizeContractPayments(payments)) throw new Error("VEHICLE_UNAVAILABLE");
        const [contract, receipt, proposal] = await Promise.all([
          tx.commercialDocument.findFirst({ where: { vehicleId, kind: "contrato", snapshot: { path: ["saleId"], equals: vehicle.sale.id } } }),
          tx.commercialDocument.findFirst({ where: { vehicleId, kind: "recibo", snapshot: { path: ["saleId"], equals: vehicle.sale.id } } }),
          tx.commercialDocument.findFirst({ where: { vehicleId, kind: "proposta", snapshot: { path: ["saleId"], equals: vehicle.sale.id } } }),
        ]);
        if (contract) return { saleId: vehicle.sale.id, contractId: contract.id, receiptId: receipt?.id, proposalId: proposal?.id };
        throw new Error("VEHICLE_UNAVAILABLE");
      }
      if (!["disponivel", "reservado", "vendido"].includes(vehicle.status)) throw new Error("VEHICLE_UNAVAILABLE");
      const reservation = await tx.vehicleReservation.findFirst({ where: { vehicleId, status: "ativa", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
      if (!reservation && vehicle.status === "reservado") {
        const expired = await tx.vehicleReservation.findFirst({ where: { vehicleId, status: "ativa" }, orderBy: { createdAt: "desc" } });
        if (!expired || expired.expiresAt > new Date()) throw new Error("VEHICLE_UNAVAILABLE");
        await tx.vehicleReservation.update({ where: { id: expired.id }, data: { status: "expirada" } });
        await tx.vehicle.update({ where: { id: vehicleId }, data: { status: "disponivel" } });
      }
      if (reservation && ((customerId && customerId !== reservation.customerId) || (!customerId && (customerName || customerPhone)))) throw new Error("RESERVATION_CUSTOMER");
      let customer = customerId && customerId !== "novo" ? await tx.customer.findUnique({ where: { id: customerId } }) : null;
      if (customerId && customerId !== "novo" && !customer) throw new Error("CUSTOMER_INVALID");
      if (!customer && reservation) customer = await tx.customer.findUnique({ where: { id: reservation.customerId } });
      if (!customer) {
        await lockCustomerIdentity(tx, customerPhone, cpf);
        if (await tx.customer.findFirst({ where: { OR: [{ phone: customerPhone }, ...(cpf ? [{ cpf }] : [])] } })) throw new Error("DUPLICATE_CUSTOMER");
        customer = await tx.customer.create({ data: { name: customerName, phone: customerPhone, cpf: cpf || null, rg: identifiers.rg || null, address: String(input.address ?? "").trim() || null } });
      } else {
        const customerCpf = cpf || customer.cpf;
        await lockCustomerIdentity(tx, customerPhone, customerCpf);
        if (await tx.customer.findFirst({ where: { OR: [{ phone: customerPhone }, ...(customerCpf ? [{ cpf: customerCpf }] : [])], NOT: { id: customer.id } } })) throw new Error("DUPLICATE_CUSTOMER");
        customer = await tx.customer.update({ where: { id: customer.id }, data: { name: customerName, phone: customerPhone, cpf: customerCpf, rg: identifiers.rg || customer.rg, address: String(input.address ?? customer.address ?? "").trim() || null } });
      }
      const heldSignal = reservation ? Number(reservation.deposit) : 0;
      const signalPayment = payments.find((p: { method: string }) => p.method === "sinal");
      const signalEnabled = input.signal === true;
      if (reservation && heldSignal > 0 && !signalEnabled) throw new Error("RESERVATION_SIGNAL_REQUIRED");
      const signal = signalEnabled ? { amount: heldSignal || Number(signalPayment?.amount ?? input.signalAmount ?? 0), reservationId: reservation?.id } : undefined;
      if (signal && (signal.amount <= 0 || signalExceedsTotal(signal.amount, total))) throw new Error("INVALID_SIGNAL");
      if (signalMismatch(payments, signal?.amount ?? 0) || (!signal && signalPayment?.amount)) throw new Error("INVALID_SIGNAL");
      const row = await tx.sale.create({ data: { vehicleId, customerId: customer.id, salePrice: total, paymentMethod: summarizeContractPayments(payments), saleDate: new Date(), notes: [notes, signal ? `Sinal recebido: R$ ${signal.amount.toFixed(2)} (incluído no total da venda).` : null].filter(Boolean).join("\n") || null } });
      const snapshot = { address: customer.address ?? "", signal, payments, customer: customer.name, customerId: customer.id, cpf: customer.cpf ?? "", rg: customer.rg ?? "", chassis: identifiers.chassis || vehicle.chassis || "", renavam: identifiers.renavam || vehicle.renavam || "", phone: customer.phone, vehicle: [vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" "), year: vehicle.year, yearModel: vehicle.yearModel, color: vehicle.color ?? "", warranty: vehicle.warranty ?? undefined, km: vehicle.km, total, plate: vehicle.plate ?? "", amount: total, conditions: String(input.conditions ?? "").slice(0, 3000), payment: summarizeContractPayments(payments), seller: "Garagem", responsibleSeller: sellerName, commission, date: new Date().toISOString(), reservationId: reservation?.id ?? null, saleId: row.id };
      let receipt = null;
      if (signal) {
        const heldReceipt = reservation ? await tx.commercialDocument.findFirst({ where: { vehicleId, kind: "recibo", snapshot: { path: ["reservationId"], equals: reservation.id } }, orderBy: { createdAt: "desc" } }) : null;
        receipt = heldReceipt
          ? await tx.commercialDocument.update({ where: { id: heldReceipt.id }, data: { snapshot: { ...(heldReceipt.snapshot as Record<string, unknown>), amount: signal.amount, total, payment: "Sinal", payments: [{ method: "sinal", amount: signal.amount }], saleId: row.id } } })
          : await tx.commercialDocument.create({ data: { vehicleId, kind: "recibo", snapshot: { ...snapshot, amount: signal.amount, total, payment: "Sinal", payments: [{ method: "sinal", amount: signal.amount }], saleId: row.id } } });
      }
      const contractSnapshot = { ...snapshot, signal: signal && receipt ? { ...signal, receiptId: String(receipt.number), date: receipt.createdAt.toISOString() } : undefined };
      const proposal = input.includeProposal === true ? await tx.commercialDocument.create({ data: { vehicleId, kind: "proposta", snapshot: contractSnapshot } }) : null;
      const contract = await tx.commercialDocument.create({ data: { vehicleId, kind: "contrato", snapshot: contractSnapshot } });
      await tx.vehicleReservation.updateMany({ where: { vehicleId, status: "ativa" }, data: { status: "convertida" } });
      await tx.vehicle.update({ where: { id: vehicleId }, data: { status: "vendido", featured: false, chassis: snapshot.chassis || null, renavam: snapshot.renavam || null } });
      await scheduleAfterSale(tx, row);
      await recordAdminAudit(tx, session.adminId, row.id, "sale.create", { salePrice: total, vehicleId, contractId: contract.id });
      return { saleId: row.id, contractId: contract.id, receiptId: receipt?.id, proposalId: proposal?.id };
    });
    revalidatePath("/admin/vendas"); revalidatePath("/admin/agenda"); revalidatePath("/admin"); revalidatePath("/admin/clientes"); revalidatePath(`/admin/veiculos/${vehicleId}`); await revalidatePublicStock(vehicleId);
    return { ok: true, message: "Venda registrada e contrato gerado.", ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = { VEHICLE_UNAVAILABLE: "Veículo indisponível ou já vendido.", RESERVATION_CUSTOMER: "A reserva pertence a outro comprador. Cancele a reserva antes de continuar.", RESERVATION_SIGNAL_REQUIRED: "A reserva tem sinal. Marque o sinal para continuar.", INVALID_SIGNAL: "O sinal deve ser positivo e não pode superar o total negociado.", DUPLICATE_CUSTOMER: "Já existe cliente com este telefone ou CPF; selecione o cadastro existente.", CUSTOMER_INVALID: "Cliente inválido." };
    return { ok: false, message: messages[message] ?? "Não foi possível registrar a venda." };
  }
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
  const sellerName = String(formData.get("sellerName") || "").trim() || null;
  const commissionRaw = String(formData.get("commission") || "").trim();
  const commission = commissionRaw ? parseMoneyBR(commissionRaw) : null;
  const rawNotes = String(formData.get("notes") || "").trim() || null;
  const notes = formatSaleNotes(rawNotes, sellerName, commission);
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
  revalidatePath("/admin/agenda");
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
        await scheduleAfterSale(tx, registered);
        await tx.vehicleReservation.updateMany({ where: { vehicleId: registered.vehicleId, status: "ativa" }, data: { status: "convertida" } });
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
        await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${vehicleId} FOR UPDATE`;
        const reservation = await tx.vehicleReservation.findFirst({ where: { vehicleId, status: { in: ["ativa", "convertida"] } }, orderBy: { createdAt: "desc" } });
        if (reservation && ((customerId && customerId !== "novo" && customerId !== reservation.customerId) || ((!customerId || customerId === "novo") && (customerName || customerPhone)))) throw new Error("RESERVATION_CUSTOMER");
        const finalCustomerId = await resolveCustomerId(tx, {
          customerId: reservation?.customerId ?? customerId,
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
            notes: reservation ? [notes, `Sinal recebido: R$ ${Number(reservation.deposit).toFixed(2)} (incluído no total da venda).`].filter(Boolean).join("\n") : notes,
          },
        });
        await scheduleAfterSale(tx, registered);
        await tx.vehicleReservation.updateMany({ where: { vehicleId: registered.vehicleId, status: "ativa" }, data: { status: "convertida" } });
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
    if (error instanceof Error && error.message === "RESERVATION_CUSTOMER") return { ok: false, message: "O cliente da venda deve ser o titular da reserva. Cancele a reserva antes de vender a outra pessoa." };
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
      for (const id of [...new Set([existing.vehicleId, vehicleId || existing.vehicleId])].sort()) await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${id} FOR UPDATE`;
      let finalCustomerId = await resolveCustomerId(tx, {
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
        await scheduleAfterSale(tx, { id: saleId, saleDate, customerId: finalCustomerId });
        await recordAdminAudit(tx, session.adminId, saleId, "sale.update", {
          salePrice: { before: existing.salePrice, after: salePrice },
          vehicleId: existing.vehicleId,
        });
        return;
      }

      const nextVehicleId = vehicleId || existing.vehicleId;
      const reservation = await tx.vehicleReservation.findFirst({ where: { vehicleId: nextVehicleId, status: "ativa" } });
      if (reservation && finalCustomerId && finalCustomerId !== reservation.customerId) throw new Error("RESERVATION_CUSTOMER");
      if (reservation) finalCustomerId = reservation.customerId;
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
      await tx.vehicleReservation.updateMany({ where: { vehicleId: nextVehicleId, status: "ativa" }, data: { status: "convertida" } });
      await scheduleAfterSale(tx, { id: saleId, saleDate, customerId: finalCustomerId });
      await recordAdminAudit(tx, session.adminId, saleId, "sale.update", {
        salePrice: { before: existing.salePrice, after: salePrice },
        vehicleId: nextVehicleId,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RESERVATION_CUSTOMER") return { ok: false, message: "O veículo está reservado para outro cliente. Confira a reserva na aba Operação." };
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
        // A reserva convertida pela venda não pode ficar ligada ao cliente anterior.
        await tx.vehicleReservation.updateMany({
          where: { vehicleId: sale.vehicleId, status: "convertida" },
          data: { status: "cancelada" },
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
