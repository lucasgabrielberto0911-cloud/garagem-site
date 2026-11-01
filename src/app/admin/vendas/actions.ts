"use server";

import { commercialStoreSnapshot } from "@/lib/commercial-store";

import { scheduleAfterSale } from "@/lib/after-sale";
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
import { type ContractPaymentItem, matchesSaleDocumentSnapshot, matchesSaleReceiptSnapshot, summarizeContractPayments } from "@/lib/admin-commercial";
import { salePromissorySnapshots } from "@/lib/sale-promissories";
import { digitsOnly, parseSaleFlowInput, resolveBuyer, resolveSignal } from "@/lib/sale-flow";

export type SaleActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

export async function finalizeSaleFlow(raw: string): Promise<{ ok: boolean; message: string; saleId?: string; contractId?: string; receiptId?: string; proposalId?: string }> {
  const session = await requireAdmin();
  const parsed = parseSaleFlowInput(raw);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const { input, vehicleId, total, payments, customerId, customerName, customerPhone, sellerName, commission, cpf, identifiers } = parsed.value;
  const notes = formatSaleNotes(null, sellerName || null, commission);
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
          tx.commercialDocument.findFirst({ where: { vehicleId, kind: "contrato", snapshot: { path: ["saleId"], equals: vehicle.sale.id } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
          tx.commercialDocument.findFirst({ where: { vehicleId, kind: "recibo", snapshot: { path: ["saleId"], equals: vehicle.sale.id } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
          tx.commercialDocument.findFirst({ where: { vehicleId, kind: "proposta", snapshot: { path: ["saleId"], equals: vehicle.sale.id } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
        ]);
        const currentCustomer = vehicle.sale.customerId
          ? await tx.customer.findUnique({ where: { id: vehicle.sale.customerId } })
          : null;
        const currentSale = {
          customerId: vehicle.sale.customerId,
          cpf: currentCustomer ? currentCustomer.cpf ?? "" : cpf,
          name: currentCustomer?.name ?? customerName,
          phone: currentCustomer?.phone ?? customerPhone,
          rg: currentCustomer ? currentCustomer.rg ?? "" : identifiers.rg,
          address: currentCustomer ? currentCustomer.address ?? "" : String(input.address ?? "").trim(),
          total,
          payments,
        };
        if (vehicle.sale.customerId && !currentCustomer) throw new Error("SALE_DOCUMENT_STALE");
        await attachPromissorySnapshot(tx, payments, { id: vehicle.sale.customerId ?? "", cpf: currentSale.cpf }, vehicle.sale.id);
        if (contract && matchesSaleDocumentSnapshot(contract.snapshot, currentSale)) return {
          saleId: vehicle.sale.id,
          contractId: contract.id,
          receiptId: receipt && matchesSaleReceiptSnapshot(receipt.snapshot, currentSale) ? receipt.id : undefined,
          proposalId: proposal && matchesSaleDocumentSnapshot(proposal.snapshot, currentSale) ? proposal.id : undefined,
        };
        throw new Error("SALE_DOCUMENT_STALE");
      }
      if (!["disponivel", "reservado", "vendido"].includes(vehicle.status)) throw new Error("VEHICLE_UNAVAILABLE");
      const reservation = await tx.vehicleReservation.findFirst({ where: { vehicleId, status: "ativa", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
      if (!reservation && vehicle.status === "reservado") {
        const expired = await tx.vehicleReservation.findFirst({ where: { vehicleId, status: "ativa" }, orderBy: { createdAt: "desc" } });
        if (!expired || expired.expiresAt > new Date()) throw new Error("VEHICLE_UNAVAILABLE");
        await tx.vehicleReservation.update({ where: { id: expired.id }, data: { status: "expirada" } });
        await tx.vehicle.update({ where: { id: vehicleId }, data: { status: "disponivel" } });
      }
      const customer = await resolveBuyer(tx, { customerId, customerName, customerPhone, cpf, rg: identifiers.rg, address: input.address, reservationCustomerId: reservation?.customerId, hasReservation: Boolean(reservation) });
      await attachPromissorySnapshot(tx, payments, customer);
      const signal = resolveSignal({ payments, total, signalEnabled: input.signal === true, signalAmountInput: input.signalAmount, reservation });
      const row = await tx.sale.create({ data: { vehicleId, customerId: customer.id, salePrice: total, paymentMethod: summarizeContractPayments(payments), saleDate: new Date(), notes: [notes, signal ? `Sinal recebido: R$ ${signal.amount.toFixed(2)} (incluído no total da venda).` : null].filter(Boolean).join("\n") || null } });
      const promissory = payments.find((payment) => payment.method === "promissoria");
      if (promissory) {
        const linked = await tx.promissoryNote.updateMany({ where: { id: { in: promissory.noteIds }, status: "emitida", saleId: null }, data: { saleId: row.id, status: "vinculada" } });
        if (linked.count !== promissory.noteIds!.length) throw new Error("PROMISSORY_UNAVAILABLE");
        await recordAdminAudit(tx, session.adminId, row.id, "promissory.link", { noteIds: promissory.noteIds });
      }
      const snapshot = { store: commercialStoreSnapshot(), address: customer.address ?? "", signal, payments, customer: customer.name, customerId: customer.id, cpf: customer.cpf ?? "", rg: customer.rg ?? "", chassis: identifiers.chassis || vehicle.chassis || "", renavam: identifiers.renavam || vehicle.renavam || "", phone: customer.phone, vehicle: [vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" "), year: vehicle.year, yearModel: vehicle.yearModel, color: vehicle.color ?? "", warranty: vehicle.warranty ?? undefined, km: vehicle.km, total, plate: vehicle.plate ?? "", amount: total, conditions: String(input.conditions ?? "").slice(0, 3000), payment: summarizeContractPayments(payments), seller: "Garagem", responsibleSeller: sellerName, commission, date: new Date().toISOString(), reservationId: reservation?.id ?? null, saleId: row.id };
      let receipt = null;
      if (signal) {
        const heldReceipt = reservation ? await tx.commercialDocument.findFirst({ where: { vehicleId, kind: "recibo", snapshot: { path: ["reservationId"], equals: reservation.id } }, orderBy: { createdAt: "desc" } }) : null;
        receipt = heldReceipt
          ? await tx.commercialDocument.update({ where: { id: heldReceipt.id }, data: { snapshot: { ...(heldReceipt.snapshot as Record<string, unknown>), customer: customer.name, customerId: customer.id, phone: customer.phone, cpf: customer.cpf ?? "", rg: customer.rg ?? "", address: customer.address ?? "", amount: signal.amount, total, payment: "Sinal", payments: [{ method: "sinal", amount: signal.amount }], saleId: row.id } } })
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
    revalidatePath("/admin/promissorias"); revalidatePath("/admin/vendas"); revalidatePath("/admin/agenda"); revalidatePath("/admin"); revalidatePath("/admin/clientes"); revalidatePath(`/admin/veiculos/${vehicleId}`); await revalidatePublicStock(vehicleId);
    return { ok: true, message: "Venda registrada e contrato gerado.", ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = { PROMISSORY_UNAVAILABLE: "Uma nota foi paga, cancelada ou vinculada a outra venda. Volte ao pagamento e atualize as notas.", PROMISSORY_BUYER: "As promissórias devem pertencer ao comprador e ter o mesmo CPF. Confira o cliente selecionado.", PROMISSORY_TOTAL: "A soma das notas difere do valor em promissórias. Volte ao pagamento e selecione as notas novamente.", VEHICLE_UNAVAILABLE: "Veículo indisponível ou já vendido.", SALE_DOCUMENT_STALE: "Os dados da venda divergiram do contrato. Reemita o contrato na operação do veículo e tente novamente.", RESERVATION_CUSTOMER: "A reserva pertence a outro comprador. Cancele a reserva antes de continuar.", RESERVATION_SIGNAL_REQUIRED: "A reserva tem sinal. Marque o sinal para continuar.", INVALID_SIGNAL: "O sinal deve ser positivo e não pode superar o total negociado.", DUPLICATE_CUSTOMER: "Já existe cliente com este telefone ou CPF; selecione o cadastro existente.", CUSTOMER_INVALID: "Cliente inválido." };
    return { ok: false, message: messages[message] ?? "Não foi possível registrar a venda." };
  }
}

async function attachPromissorySnapshot(tx: Prisma.TransactionClient, payments: ContractPaymentItem[], buyer: { id: string; cpf: string | null }, saleId?: string) {
  const payment = payments.find((item) => item.method === "promissoria");
  if (!payment) return;
  const notes = await tx.promissoryNote.findMany({ where: { id: { in: payment.noteIds } } });
  payment.notes = salePromissorySnapshots(payment, notes.map((note) => ({ ...note, amount: Number(note.amount), dueDate: note.dueDate.toISOString().slice(0, 10) })), buyer, saleId);
}

/** Busca privada: somente notas livres do CPF informado, com filtro de número. */
export async function availableSalePromissories(cpfInput: string, query = "", ids?: string[]) {
  await requireAdmin();
  const cpf = digitsOnly(cpfInput);
  if (cpf.length !== 11 || (query.trim() && (!/^\d+$/.test(query.trim()) || Number(query) > 2147483647))) return [];
  const notes = await prisma.promissoryNote.findMany({
    where: { status: "emitida", saleId: null, ...(ids ? { id: { in: ids.slice(0, 60) } } : {}), issuerCpf: `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`, ...(query.trim() ? { number: Number(query) || -1 } : {}) },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }], take: 100,
    select: { id: true, number: true, amount: true, dueDate: true },
  });
  return notes.map((note) => ({ ...note, amount: Number(note.amount), dueDate: note.dueDate.toISOString().slice(0, 10) }));
}

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** Cliente da venda do modal: cadastro escolhido, ou novo por `resolveBuyer` (mesma regra de duplicado do assistente). Sem nome e telefone, fica sem cliente. */
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
  if (!customerName && !customerPhone) return null;
  const customer = await resolveBuyer(tx, { customerId: "novo", customerName, customerPhone, cpf: "", rg: "", address: undefined, hasReservation: false });
  return customer.id;
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
  if (isNewCustomer && (customerName || customerPhone)) {
    if (!customerName) fieldErrors.customerName = "Informe o nome do cliente, ou apague o telefone para registrar sem cliente.";
    if (customerPhone.length < 10) fieldErrors.customerPhone = "Telefone incompleto: informe com DDD (10 ou 11 dígitos).";
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
          "Já existe cliente com esse telefone ou CPF. Escolha o cadastro no campo Cliente antes de registrar.",
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
      await tx.vehicle.update({
        where: { id: nextVehicleId },
        data: { status: "vendido", featured: false },
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
