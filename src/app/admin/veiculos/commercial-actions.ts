"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { descriptionPriceSaveError } from "@/lib/admin-vehicle-validate";
import { recordVehiclePriceChange } from "@/lib/vehicle-price-history";
import { parseMoneyBR } from "@/lib/admin-money";
import { isValidCpf } from "@/lib/format";
import { ENTRY_ITEMS, FINANCE_STATUSES, financingSimulationDown, parseVehicleCustomerIds, resolveIdField, signalExceedsTotal, signalMismatch, parseContractPaymentsJson, simulateFinancing, suggestPrice, summarizeContractPayments, sumContractPayments } from "@/lib/admin-commercial";
import { recordAdminAudit } from "@/lib/admin-audit";
import { expireAdminData } from "@/lib/admin-revalidate";
import { revalidatePublicStock, revalidatePublicStockMany } from "@/lib/public-stock-revalidate";
import { completeCustomerFields } from "@/lib/admin-customer-complete";
import { expireReservations } from "@/lib/reservations";

class CommercialError extends Error {}

async function reserveVehicle(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  vehicle: { id: string; status: string; price: number; sale: unknown | null },
  customer: { id: string },
  deposit: number,
  expiresAtRaw: string,
  adminId: string,
) {
  if (vehicle.status !== "disponivel" || vehicle.sale) throw new CommercialError("Só é possível reservar veículo disponível e sem venda.");
  const expiresAt = new Date(`${expiresAtRaw}:00-03:00`);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) throw new CommercialError("Informe um prazo futuro para a reserva.");
  if (deposit > vehicle.price) throw new CommercialError("Sinal não pode superar o preço do veículo.");
  const reservation = await tx.vehicleReservation.create({ data: { vehicleId: vehicle.id, customerId: customer.id, deposit, expiresAt } });
  await tx.vehicle.update({ where: { id: vehicle.id }, data: { status: "reservado", featured: false } });
  await recordAdminAudit(tx, adminId, vehicle.id, "commercial.reserve", { operation: "reserve", customerId: customer.id, deposit, expiresAt: expiresAt.toISOString() });
  return reservation;
}

export async function releaseExpiredReservations() {
  if (!(await getSession())) return;
  const ids = await expireReservations();
  if (ids.length) {
    await revalidatePublicStockMany(ids);
    revalidatePath("/admin/veiculos");
    for (const id of ids) revalidatePath(`/admin/veiculos/${id}`);
  }
}

/** Completa CPF e endereço do cliente antes de gerar o contrato (só preenche o que estiver vazio). */
export async function completeCustomerData(customerId: string, cpfRaw: string, addressRaw: string): Promise<{ ok: boolean; message: string; cpf?: string | null; address?: string | null }> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sessão expirada." };
  const cpf = cpfRaw.replace(/\D/g, "");
  const address = addressRaw.trim().slice(0, 300);
  if (cpf && !isValidCpf(cpf)) return { ok: false, message: "CPF inválido. Confira os 11 dígitos." };
  try {
    const result = await prisma.$transaction((tx) => completeCustomerFields(tx, customerId, cpf, address));
    if (!result.ok) return result;
    revalidatePath("/admin/clientes");
    return { ok: true, message: "Dados do cliente atualizados.", cpf: result.cpf, address: result.address };
  } catch {
    return { ok: false, message: "Não foi possível atualizar o cliente." };
  }
}

export async function saveCommercial(vehicleId: string, form: FormData): Promise<{ ok: boolean; message: string; documentId?: string; documentNumber?: number }> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sessão expirada." };
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const money = (name: string) => {
    const value = parseMoneyBR(form.get(name));
    if (value == null || value < 0) throw new CommercialError("Informe valores monetários válidos, usando vírgula nos centavos.");
    return value;
  };
  let documentId: string | undefined;
  let documentNumber: number | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      // Todas as operações comerciais do veículo compartilham a mesma trava.
      await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${vehicleId} FOR UPDATE`;
      const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId }, include: { costs: true, sale: true } });
      const operation = text("operation");
      if (operation === "reserve") {
        const customer = await tx.customer.findUnique({ where: { id: text("customerId") } });
        if (!customer) throw new CommercialError("Escolha um cliente cadastrado.");
        await reserveVehicle(tx, vehicle, customer, money("deposit"), text("expiresAt"), session.adminId);
      } else if (operation === "cancel-reservation") {
        const result = await tx.vehicleReservation.updateMany({ where: { vehicleId, status: "ativa" }, data: { status: "cancelada" } });
        if (!result.count) throw new CommercialError("Não há reserva ativa.");
        if (vehicle.status === "reservado" && !vehicle.sale) await tx.vehicle.update({ where: { id: vehicleId }, data: { status: "disponivel" } });
      } else if (operation === "extend-reservation") {
        const reservation = await tx.vehicleReservation.findFirst({ where: { vehicleId, status: "ativa" }, orderBy: { createdAt: "desc" } });
        if (!reservation) throw new CommercialError("Não há reserva ativa.");
        const expiresAt = new Date(`${text("expiresAt")}:00-03:00`);
        if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date() || expiresAt <= reservation.expiresAt) throw new CommercialError("Informe um prazo futuro e posterior ao atual.");
        await tx.vehicleReservation.update({ where: { id: reservation.id }, data: { expiresAt } });
      } else if (operation === "price") {
        if (vehicle.status === "vendido" || vehicle.sale) throw new CommercialError("Veículo vendido não recebe ajuste de preço.");
        const suggestion = suggestPrice({ price: vehicle.price, purchase: vehicle.purchasePrice, costs: vehicle.costs.reduce((sum, cost) => sum + cost.amount, 0), days: Math.max(0, Math.floor((Date.now() - vehicle.createdAt.getTime()) / 86400000)), margin: money("margin"), consigned: vehicle.consigned });
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
        if (!["proposta", "contrato", "recibo"].includes(kind)) throw new CommercialError("Documento inválido.");
        const customer = await tx.customer.findUnique({ where: { id: text("customerId") } });
        if (!customer) throw new CommercialError("Escolha um cliente cadastrado.");
        const amount = money("amount");
        const ids = parseVehicleCustomerIds({ chassis: text("chassis"), renavam: text("renavam"), rg: text("rg") });
        if (ids.error) throw new CommercialError(ids.error);
        // Campo ausente mantém o cadastro; campo enviado vazio remove o valor.
        const chassis = resolveIdField(form.has("chassis"), ids.chassis, vehicle.chassis);
        const renavam = resolveIdField(form.has("renavam"), ids.renavam, vehicle.renavam);
        const rg = resolveIdField(form.has("rg"), ids.rg, customer.rg);
        const isContract = kind === "proposta" || kind === "contrato";
        const parsedPayments = isContract ? parseContractPaymentsJson(text("payments")) : undefined;
        let paymentText = text("payment");
        if (!paymentText && parsedPayments) {
          paymentText = summarizeContractPayments(parsedPayments);
        }
        if (!amount || !paymentText || paymentText.length > 200 || text("conditions").length > 3000) throw new CommercialError("Informe valor positivo, forma de pagamento e condições de até 3.000 caracteres.");
        // Vendido só recebe contrato da própria venda (mesmo cliente, ou venda sem cliente vinculado).
        if (isContract && vehicle.status === "vendido" && !(vehicle.sale && (!vehicle.sale.customerId || vehicle.sale.customerId === customer.id))) throw new CommercialError("Veículo vendido só recebe contrato do cliente da venda.");
        if (isContract && vehicle.sale && Math.round(amount * 100) !== Math.round(vehicle.sale.salePrice * 100)) throw new CommercialError("O valor do contrato deve ser igual ao valor da venda. Edite a venda em Vendas antes de emitir outro valor.");
        let reservation = kind === "recibo" ? await tx.vehicleReservation.findFirst({ where: { vehicleId, customerId: customer.id, status: { in: ["ativa", "convertida"] } }, orderBy: { createdAt: "desc" } }) : null;
        if (kind === "recibo" && !reservation && text("expiresAt")) {
          reservation = await reserveVehicle(tx, vehicle, customer, amount, text("expiresAt"), session.adminId);
        }
        if (kind === "recibo" && !reservation && vehicle.sale?.customerId !== customer.id) throw new CommercialError("Recibo exige reserva ativa (informe o prazo) ou venda do veículo para este cliente.");

        // Contrato: o sinal já pago (recibo da reserva) é abatido do preço.
        let signal: { amount: number; receiptId?: string; date?: string } | undefined;
        let signalReservationId: string | null = null;
        if (isContract) {
          const held = await tx.vehicleReservation.findFirst({ where: { vehicleId, customerId: customer.id, status: { in: ["ativa", "convertida"] } }, orderBy: { createdAt: "desc" } });
          const receipt = held ? await tx.commercialDocument.findFirst({ where: { vehicleId, kind: "recibo", snapshot: { path: ["reservationId"], equals: held.id } }, orderBy: { createdAt: "desc" } }) : null;
          const sinalItem = parsedPayments?.find((p) => p.method === "sinal");
          const signalEnabled = text("signalEnabled") === "on" || Number(held?.deposit) > 0 || (sinalItem?.amount ?? 0) > 0;
          if (signalEnabled && held && Number(held.deposit) > 0) {
            signal = { amount: Number(held.deposit), receiptId: receipt ? String(receipt.number) : undefined, date: receipt?.createdAt.toISOString() };
            signalReservationId = held.id;
          } else if (signalEnabled && sinalItem && sinalItem.amount > 0) {
            let receiptId = text("legacySignalReceiptId");
            if (!receiptId && vehicle.sale?.id) {
              const saleReceipt = await tx.commercialDocument.findFirst({
                where: { vehicleId, kind: "recibo", snapshot: { path: ["saleId"], equals: vehicle.sale.id } },
                orderBy: { createdAt: "desc" },
              });
              const saleReceiptSnapshot = saleReceipt?.snapshot as { amount?: number; customerId?: string } | null;
              if (saleReceipt && saleReceiptSnapshot?.customerId === customer.id && Number(saleReceiptSnapshot.amount) === sinalItem.amount) {
                receiptId = String(saleReceipt.number);
              }
            }
            if (receiptId) {
              const receiptNumber = Number(receiptId);
              const receiptDoc = Number.isInteger(receiptNumber) && receiptNumber > 0
                ? await tx.commercialDocument.findFirst({ where: { vehicleId, kind: "recibo", number: receiptNumber } })
                : null;
              const receiptSnapshot = receiptDoc?.snapshot as { amount?: number; customerId?: string; saleId?: string | null; reservationId?: string | null } | null;
              const linkedReservation = receiptSnapshot?.reservationId
                ? await tx.vehicleReservation.findFirst({ where: { id: receiptSnapshot.reservationId, vehicleId, customerId: customer.id, status: { in: ["ativa", "convertida"] } } })
                : null;
              const linkedToSale = receiptSnapshot?.saleId === vehicle.sale?.id && receiptSnapshot?.customerId === customer.id;
              if (!receiptDoc || Number(receiptSnapshot?.amount) !== sinalItem.amount || (!linkedToSale && !linkedReservation)) {
                throw new CommercialError("O recibo do sinal não pertence ao comprador atual desta venda.");
              }
            }
            signal = { amount: sinalItem.amount, date: sinalItem.signalDate, receiptId: receiptId || undefined };
          } else if (signalEnabled) {
            const dep = parseMoneyBR(form.get("deposit"));
            if (dep && dep > 0) signal = { amount: dep };
          }
          if (signal && signalExceedsTotal(signal.amount, amount)) throw new CommercialError("O sinal já pago não pode superar o preço total do contrato.");
        }
        if (isContract && parsedPayments) {
          const mismatch = signalMismatch(parsedPayments, signal?.amount ?? 0);
          if (mismatch) throw new CommercialError(mismatch);
          const totalPayments = sumContractPayments(parsedPayments);
          if (Math.abs(totalPayments - amount) > 0.01) {
            throw new CommercialError("A soma das formas de pagamento deve ser igual ao valor total do veículo.");
          }
        }
        const rawDownPayment = parseMoneyBR(form.get("downPayment"));
        if (isContract && rawDownPayment != null && rawDownPayment >= amount) throw new CommercialError("A entrada deve ser menor que o valor total do contrato.");
        const signalAmount = signal?.amount ?? 0;
        const downPayment = rawDownPayment != null ? Math.max(0, rawDownPayment - signalAmount) : undefined;
        const rawFinanced = parseMoneyBR(form.get("financed"));
        const totalEntry = rawDownPayment != null ? rawDownPayment : signalAmount;
        if (isContract && !parsedPayments && rawFinanced != null && totalEntry + rawFinanced > amount) throw new CommercialError("A soma de sinal, entrada e financiamento não pode superar o valor do contrato.");
        const financed = rawFinanced ?? (text("bank") ? Math.max(0, amount - totalEntry) : undefined);

        // Dados informados no contrato voltam ao cadastro, para o próximo documento sair pré-preenchido.
        if (isContract) {
          if (chassis !== (vehicle.chassis ?? "") || renavam !== (vehicle.renavam ?? "")) {
            await tx.vehicle.update({ where: { id: vehicleId }, data: { chassis: chassis || null, renavam: renavam || null } });
          }
          if (rg !== (customer.rg ?? "")) await tx.customer.update({ where: { id: customer.id }, data: { rg: rg || null } });
        }

        const doc = await tx.commercialDocument.create({
          data: {
            vehicleId,
            kind,
            snapshot: {
              address: customer.address ?? "",
              signal,
              downPayment: downPayment && downPayment > 0 ? downPayment : undefined,
              financed: financed && financed > 0 ? financed : undefined,
              payments: parsedPayments,
              customer: customer.name,
              customerId: customer.id,
              cpf: customer.cpf ?? "",
              rg,
              chassis,
              renavam,
              phone: customer.phone,
              vehicle: [vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" "),
              year: vehicle.year,
              yearModel: vehicle.yearModel,
              color: vehicle.color ?? "",
              warranty: vehicle.warranty?.trim() || undefined,
              km: vehicle.km,
              total: isContract ? amount : (parseMoneyBR(form.get("price")) ?? parseMoneyBR(form.get("total")) ?? vehicle.price),
              plate: vehicle.plate ?? "",
              amount,
              conditions: text("conditions"),
              payment: paymentText.slice(0, 200),
              seller: session.email,
              date: new Date().toISOString(),
              reservationId: reservation?.id ?? signalReservationId,
              saleId: vehicle.sale?.id ?? null,
            },
          },
        });
        documentId = doc.id;
        documentNumber = doc.number;

        if (text("bank") && text("rate") && text("months")) {
          const rate = Number(text("rate").replace(",", "."));
          const months = Number(text("months"));
          if (Number.isFinite(rate) && Number.isFinite(months) && months > 0) {
            const downForSim = (parsedPayments && financingSimulationDown(amount, parsedPayments)) ?? rawDownPayment ?? signalAmount;
            const simPrice = isContract ? amount : (parseMoneyBR(form.get("price")) ?? vehicle.price);
            let sim: ReturnType<typeof simulateFinancing> | null = null;
            try {
              sim = simulateFinancing(simPrice, downForSim, rate, months);
            } catch {
              // não impede criação do documento se os parâmetros de juros forem inconsistentes
            }
            if (sim) {
              await tx.financeSimulation.create({
                data: {
                  vehicleId,
                  customerName: customer.name,
                  bank: text("bank").slice(0, 160),
                  price: simPrice,
                  downPayment: downForSim,
                  rate,
                  months,
                  installment: sim.installment,
                },
              });
            }
          }
        }
      } else throw new CommercialError("Operação inválida.");
      if (operation !== "reserve") {
        await recordAdminAudit(tx, session.adminId, vehicleId, `commercial.${operation}`, { operation });
      }
    });
  } catch (error) {
    return { ok: false, message: error instanceof CommercialError ? error.message : "Não foi possível salvar. Atualize a página e tente novamente." };
  }
  revalidatePath(`/admin/veiculos/${vehicleId}`);
  revalidatePath("/admin/vendas");
  revalidatePath("/admin/agenda");
  if (text("operation") === "extend-reservation") expireAdminData();
  if (["reserve", "cancel-reservation", "price"].includes(text("operation")) || (text("operation") === "assessment" && form.get("approved") === "on") || (text("operation") === "document" && text("kind") === "recibo")) await revalidatePublicStock(vehicleId);
  return { ok: true, message: "Operação registrada.", documentId, documentNumber };
}

export async function completeAfterSale(id: string) {
  const session = await getSession();
  if (!session) return;
  await prisma.afterSaleTask.updateMany({ where: { id, completedAt: null }, data: { completedAt: new Date() } });
  revalidatePath("/admin/agenda");
}
