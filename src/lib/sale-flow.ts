import type { Customer, Prisma } from "@prisma/client";
import { lockCustomerIdentity } from "@/lib/admin-customer-lock";
import { parseContractPaymentsJson, parseVehicleCustomerIds, signalExceedsTotal, signalMismatch, sumContractPayments } from "@/lib/admin-commercial";
import type { ContractPaymentItem } from "@/lib/admin-commercial";
import { isValidCpf } from "@/lib/format";

export type SaleFlowPayload = { vehicleId?: string; total?: number; payments?: unknown; customerId?: string; customerName?: string; customerPhone?: string; seller?: string; commission?: number | null; signal?: boolean; signalAmount?: number; chassis?: string; renavam?: string; cpf?: string; rg?: string; address?: string; conditions?: string; includeProposal?: boolean };

export type ParsedSaleFlow = {
  input: SaleFlowPayload;
  vehicleId: string;
  total: number;
  payments: ContractPaymentItem[];
  customerId: string;
  customerName: string;
  customerPhone: string;
  sellerName: string;
  commission: number | null;
  cpf: string;
  identifiers: { chassis: string; renavam: string; rg: string };
};

export type SaleFlowParseResult = { ok: true; value: ParsedSaleFlow } | { ok: false; message: string };

export function digitsOnly(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

/** Valida o JSON enviado pelo fluxo de venda (pagamentos, soma, comprador, identificadores). Pura: não toca no banco. */
export function parseSaleFlowInput(raw: string): SaleFlowParseResult {
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return fail("Dados da venda inválidos."); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fail("Dados da venda inválidos.");
  const input = payload as SaleFlowPayload;
  const vehicleId = typeof input.vehicleId === "string" ? input.vehicleId : "";
  const paymentCheck = validatePayments(vehicleId, input.total, input.payments);
  if (!paymentCheck.ok) return paymentCheck;
  const { total, payments } = paymentCheck;
  const customerId = typeof input.customerId === "string" ? input.customerId : "";
  const customerName = String(input.customerName ?? "").trim();
  const customerPhone = digitsOnly(input.customerPhone);
  if (!customerName || customerPhone.length < 10) return fail("Informe nome e telefone válidos do comprador.");
  const sellerName = String(input.seller ?? "").trim();
  const commission = input.commission == null ? null : Number(input.commission);
  if (commission != null && (!Number.isFinite(commission) || commission < 0)) return fail("Comissão inválida.");
  const cpf = digitsOnly(input.cpf);
  const identifiers = parseVehicleCustomerIds({ chassis: input.chassis, renavam: input.renavam, rg: input.rg });
  if (cpf && !isValidCpf(cpf)) return fail("CPF inválido. Confira os 11 dígitos.");
  if (identifiers.error) return fail(identifiers.error);
  return { ok: true, value: { input, vehicleId, total, payments, customerId, customerName, customerPhone, sellerName, commission, cpf, identifiers } };
}

function validatePayments(vehicleId: string, rawTotalInput: unknown, paymentsInput: unknown): { ok: true; total: number; payments: ContractPaymentItem[] } | { ok: false; message: string } {
  const rawTotal = Number(rawTotalInput);
  const total = Math.round(rawTotal * 100) / 100;
  const parsedPayments = (() => { try { return parseContractPaymentsJson(JSON.stringify(paymentsInput ?? [])); } catch { return undefined; } })();
  if (!vehicleId || !Number.isFinite(rawTotal) || Math.abs(rawTotal - total) > 0.000001 || !Number.isSafeInteger(Math.round(total * 100)) || total <= 0 || !parsedPayments?.length || Math.abs(sumContractPayments(parsedPayments) - total) > 0.001) return fail("A soma dos pagamentos deve ser igual ao valor negociado.");
  const payments = parsedPayments;
  if (new Set(payments.map((payment) => payment.method)).size !== payments.length) return fail("Selecione cada forma de pagamento uma única vez.");
  const incomplete = payments.some((payment) => payment.amount <= 0
    || (payment.method === "financiamento" && !payment.installments)
    || (payment.method === "troca" && (!payment.tradeVehicle?.trim() || !payment.tradePlate?.trim()))
    || (payment.method === "cartao" && !payment.installments));
  if (incomplete) return fail("Complete os campos da forma de pagamento selecionada.");
  return { ok: true, total, payments };
}

type Tx = Prisma.TransactionClient;

/** Resolve (e grava) o comprador: cliente existente, cliente da reserva ou novo. Lança DUPLICATE_CUSTOMER, CUSTOMER_INVALID ou RESERVATION_CUSTOMER. */
export async function resolveBuyer(
  tx: Tx,
  p: { customerId: string; customerName: string; customerPhone: string; cpf: string; rg: string; address: unknown; reservationCustomerId?: string | null; hasReservation: boolean },
): Promise<Customer> {
  const { customerId, customerName, customerPhone, cpf } = p;
  if (p.hasReservation && ((customerId && customerId !== p.reservationCustomerId) || (!customerId && (customerName || customerPhone)))) throw new Error("RESERVATION_CUSTOMER");
  let customer = customerId && customerId !== "novo" ? await tx.customer.findUnique({ where: { id: customerId } }) : null;
  if (customerId && customerId !== "novo" && !customer) throw new Error("CUSTOMER_INVALID");
  if (!customer && p.reservationCustomerId) customer = await tx.customer.findUnique({ where: { id: p.reservationCustomerId } });
  if (!customer) {
    await lockCustomerIdentity(tx, customerPhone, cpf);
    if (await tx.customer.findFirst({ where: { OR: [{ phone: customerPhone }, ...(cpf ? [{ cpf }] : [])] } })) throw new Error("DUPLICATE_CUSTOMER");
    return tx.customer.create({ data: { name: customerName, phone: customerPhone, cpf: cpf || null, rg: p.rg || null, address: String(p.address ?? "").trim() || null } });
  }
  const customerCpf = cpf || customer.cpf;
  await lockCustomerIdentity(tx, customerPhone, customerCpf);
  if (await tx.customer.findFirst({ where: { OR: [{ phone: customerPhone }, ...(customerCpf ? [{ cpf: customerCpf }] : [])], NOT: { id: customer.id } } })) throw new Error("DUPLICATE_CUSTOMER");
  return tx.customer.update({ where: { id: customer.id }, data: { name: customerName, phone: customerPhone, cpf: customerCpf, rg: p.rg || customer.rg, address: String(p.address ?? customer.address ?? "").trim() || null } });
}

export type SaleSignal = { amount: number; reservationId: string | undefined };

/** Define o sinal da venda. Lança RESERVATION_SIGNAL_REQUIRED ou INVALID_SIGNAL. */
export function resolveSignal(p: { payments: ContractPaymentItem[]; total: number; signalEnabled: boolean; signalAmountInput?: number; reservation: { id: string; deposit: unknown } | null }): SaleSignal | undefined {
  const heldSignal = p.reservation ? Number(p.reservation.deposit) : 0;
  const signalPayment = p.payments.find((item) => item.method === "sinal");
  if (p.reservation && heldSignal > 0 && !p.signalEnabled) throw new Error("RESERVATION_SIGNAL_REQUIRED");
  const signal = p.signalEnabled ? { amount: heldSignal || Number(signalPayment?.amount ?? p.signalAmountInput ?? 0), reservationId: p.reservation?.id } : undefined;
  if (signal && (signal.amount <= 0 || signalExceedsTotal(signal.amount, p.total))) throw new Error("INVALID_SIGNAL");
  if (signalMismatch(p.payments, signal?.amount ?? 0) || (!signal && signalPayment?.amount)) throw new Error("INVALID_SIGNAL");
  return signal;
}
