"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { descriptionPriceSaveError } from "@/lib/admin-vehicle-validate";
import { recordVehiclePriceChange } from "@/lib/vehicle-price-history";
import { parseMoneyBR } from "@/lib/admin-money";
import { ENTRY_ITEMS, FINANCE_STATUSES, simulateFinancing, suggestPrice } from "@/lib/admin-commercial";
import { recordAdminAudit } from "@/lib/admin-audit";
import { revalidatePublicStock, revalidatePublicStockMany } from "@/lib/public-stock-revalidate";
import { expireReservations } from "@/lib/reservations";

class CommercialError extends Error {}

export async function releaseExpiredReservations() {
  if (!(await getSession())) return;
  const ids = await expireReservations();
  if (ids.length) {
    await revalidatePublicStockMany(ids);
    revalidatePath("/admin/veiculos");
    for (const id of ids) revalidatePath(`/admin/veiculos/${id}`);
  }
}

export async function saveCommercial(vehicleId: string, form: FormData): Promise<{ ok: boolean; message: string; documentId?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sessão expirada." };
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const money = (name: string) => {
    const value = parseMoneyBR(form.get(name));
    if (value == null || value < 0) throw new CommercialError("Informe valores monetários válidos, usando vírgula nos centavos.");
    return value;
  };
  let documentId: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      // Todas as operações comerciais do veículo compartilham a mesma trava.
      await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${vehicleId} FOR UPDATE`;
      const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId }, include: { costs: true, sale: true } });
      const operation = text("operation");
      if (operation === "reserve") {
        if (vehicle.status !== "disponivel" || vehicle.sale) throw new CommercialError("Só é possível reservar veículo disponível e sem venda.");
        const deposit = money("deposit");
        const expiresAt = new Date(`${text("expiresAt")}:00-03:00`);
        if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) throw new CommercialError("Informe um prazo futuro para a reserva.");
        if (deposit > vehicle.price) throw new CommercialError("Sinal não pode superar o preço do veículo.");
        const customer = await tx.customer.findUnique({ where: { id: text("customerId") } });
        if (!customer) throw new CommercialError("Escolha um cliente cadastrado.");
        await tx.vehicleReservation.create({ data: { vehicleId, customerId: customer.id, deposit, expiresAt } });
        await tx.vehicle.update({ where: { id: vehicleId }, data: { status: "reservado", featured: false } });
      } else if (operation === "cancel-reservation") {
        const result = await tx.vehicleReservation.updateMany({ where: { vehicleId, status: "ativa" }, data: { status: "cancelada" } });
        if (!result.count) throw new CommercialError("Não há reserva ativa.");
        if (vehicle.status === "reservado" && !vehicle.sale) await tx.vehicle.update({ where: { id: vehicleId }, data: { status: "disponivel" } });
      } else if (operation === "price") {
        if (vehicle.status === "vendido" || vehicle.sale) throw new CommercialError("Veículo vendido não recebe ajuste de preço.");
        const suggestion = suggestPrice({ price: vehicle.price, fipe: vehicle.fipePrice, purchase: vehicle.purchasePrice, costs: vehicle.costs.reduce((sum, cost) => sum + cost.amount, 0), days: Math.max(0, Math.floor((Date.now() - vehicle.createdAt.getTime()) / 86400000)), margin: money("margin"), consigned: vehicle.consigned });
        if (!suggestion || suggestion.price >= vehicle.price) throw new CommercialError("Sem redução sugerida com esta margem mínima.");
        const priceError = descriptionPriceSaveError({ description: vehicle.description, price: suggestion.price, status: vehicle.status });
        if (priceError) throw new CommercialError(priceError);
        await tx.vehicle.update({ where: { id: vehicleId }, data: { price: suggestion.price } });
        await recordVehiclePriceChange(vehicleId, vehicle.price, suggestion.price, tx);
      } else if (operation === "assessment") {
        const items = ENTRY_ITEMS.map((label, index) => ({ label, status: text(`item${index}`) }));
        if (items.some((item) => !["pendente", "ok", "atencao", "na"].includes(item.status))) throw new CommercialError("Checklist inválido.");
        const approved = form.get("approved") === "on";
        if (approved && items.some((item) => item.status === "pendente")) throw new CommercialError("Conclua todos os itens antes de aprovar.");
        const data = { items, notes: text("notes").slice(0, 4000), offer: money("offer"), approved };
        await tx.vehicleAssessment.upsert({ where: { vehicleId }, create: { vehicleId, ...data }, update: data });
        if (approved) await tx.vehicle.update({ where: { id: vehicleId }, data: { purchasePrice: data.offer, hasSpareKey: items[12].status === "ok", hasManual: items[13].status === "ok" } });
      } else if (operation === "finance") {
        const price = money("price"), downPayment = money("downPayment"), rate = Number(text("rate").replace(",", ".")), months = Number(text("months"));
        let installment: number;
        try { installment = simulateFinancing(price, downPayment, rate, months).installment; }
        catch (error) { throw new CommercialError((error as Error).message); }
        if (!text("customerName") || !text("bank") || text("customerName").length > 160 || text("bank").length > 160) throw new CommercialError("Informe cliente e banco com até 160 caracteres.");
        await tx.financeSimulation.create({ data: { vehicleId, customerName: text("customerName"), bank: text("bank"), price, downPayment, rate, months, installment } });
      } else if (operation === "finance-status") {
        const status = text("status");
        if (!(FINANCE_STATUSES as readonly string[]).includes(status)) throw new CommercialError("Status inválido.");
        const result = await tx.financeSimulation.updateMany({ where: { id: text("simulationId"), vehicleId }, data: { status } });
        if (!result.count) throw new CommercialError("Simulação não encontrada.");
      } else if (operation === "document") {
        const kind = text("kind");
        if (!["proposta", "recibo"].includes(kind)) throw new CommercialError("Documento inválido.");
        const customer = await tx.customer.findUnique({ where: { id: text("customerId") } });
        if (!customer) throw new CommercialError("Escolha um cliente cadastrado.");
        const amount = money("amount");
        if (!amount || !text("payment") || text("payment").length > 200 || !text("conditions") || text("conditions").length > 3000) throw new CommercialError("Informe valor positivo e condições de até 3.000 caracteres.");
        if (kind === "proposta" && vehicle.status === "vendido") throw new CommercialError("Veículo vendido não recebe proposta.");
        const reservation = kind === "recibo" ? await tx.vehicleReservation.findFirst({ where: { vehicleId, customerId: customer.id, status: { in: ["ativa", "convertida"] } }, orderBy: { createdAt: "desc" } }) : null;
        if (kind === "recibo" && (!reservation || Number(reservation.deposit) !== amount)) throw new CommercialError("Recibo de sinal exige reserva do cliente com o mesmo valor recebido.");
        // Contrato: o sinal já pago (recibo da reserva) é abatido do preço.
        let signal: { amount: number; receiptId: string; date: string } | undefined;
        if (kind === "proposta") {
          const held = await tx.vehicleReservation.findFirst({ where: { vehicleId, customerId: customer.id, status: { in: ["ativa", "convertida"] } }, orderBy: { createdAt: "desc" } });
          const receipt = held ? await tx.commercialDocument.findFirst({ where: { vehicleId, kind: "recibo", snapshot: { path: ["reservationId"], equals: held.id } }, orderBy: { createdAt: "desc" } }) : null;
          if (held && receipt) signal = { amount: Number(held.deposit), receiptId: receipt.id, date: receipt.createdAt.toISOString() };
        }
        const doc = await tx.commercialDocument.create({ data: { vehicleId, kind, snapshot: { address: customer.address ?? "", signal, customer: customer.name, cpf: customer.cpf ?? "", phone: customer.phone, vehicle: [vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" "), year: vehicle.year, yearModel: vehicle.yearModel, color: vehicle.color ?? "", km: vehicle.km, total: vehicle.price, plate: vehicle.plate ?? "", amount, conditions: text("conditions"), payment: text("payment").slice(0, 200), seller: session.email, sellerName: text("sellerName").slice(0, 120), date: new Date().toISOString(), reservationId: reservation?.id ?? null, saleId: vehicle.sale?.id ?? null } } });
        documentId = doc.id;
      } else throw new CommercialError("Operação inválida.");
      await recordAdminAudit(tx, session.adminId, vehicleId, `commercial.${operation}`, { operation });
    });
  } catch (error) {
    return { ok: false, message: error instanceof CommercialError ? error.message : "Não foi possível salvar. Atualize a página e tente novamente." };
  }
  revalidatePath(`/admin/veiculos/${vehicleId}`);
  revalidatePath("/admin/agenda");
  if (["reserve", "cancel-reservation", "price"].includes(text("operation")) || (text("operation") === "assessment" && form.get("approved") === "on")) await revalidatePublicStock(vehicleId);
  return { ok: true, message: "Operação registrada.", documentId };
}

export async function completeAfterSale(id: string) {
  const session = await getSession();
  if (!session) return;
  await prisma.afterSaleTask.updateMany({ where: { id, completedAt: null }, data: { completedAt: new Date() } });
  revalidatePath("/admin/agenda");
}
