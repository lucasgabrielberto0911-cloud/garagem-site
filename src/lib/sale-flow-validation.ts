import { formatAdminMoney, moneyDifference, parseMoneyBR } from "./admin-money";
import type { ContractPaymentItem } from "./admin-commercial";
import { sumContractPayments } from "./admin-commercial";
import { isValidCpf } from "./format";

/** Etapas do assistente de venda, na ordem em que aparecem. */
export const SALE_STAGE = { vehicle: 0, customer: 1, payment: 2, seller: 3, review: 4 } as const;

export type SaleDraft = {
  vehicleId: string;
  customer: { name: string; phone: string; cpf: string } | null;
  total: number;
  payments: ContractPaymentItem[];
  commission: string;
};

export type StageProblem = { stage: number; message: string };

const digits = (value: string) => value.replace(/\D/g, "");

/** Primeiro problema da etapa, com mensagem que diz o que fazer. Pura: roda no navegador antes de avançar. */
export function validateSaleStage(stage: number, draft: SaleDraft): string | null {
  if (stage === SALE_STAGE.vehicle) return draft.vehicleId ? null : "Escolha o veículo vendido na busca.";
  if (stage === SALE_STAGE.customer) {
    if (!draft.customer) return "Busque um cliente já cadastrado ou marque “Cadastrar cliente nesta venda”.";
    if (!draft.customer.name.trim()) return "Informe o nome do comprador.";
    if (digits(draft.customer.phone).length < 10) return "Informe o telefone do comprador com DDD (10 ou 11 dígitos).";
    const cpf = digits(draft.customer.cpf);
    if (cpf && !isValidCpf(cpf)) return "CPF inválido. Confira os 11 dígitos ou deixe em branco.";
    return null;
  }
  if (stage === SALE_STAGE.payment) return paymentProblem(draft.total, draft.payments);
  if (stage === SALE_STAGE.seller) {
    const commission = draft.commission.trim();
    if (!commission) return null;
    const value = parseMoneyBR(commission);
    return value !== null && value >= 0 ? null : "Comissão inválida. Use um valor em reais, por exemplo 1.500,00.";
  }
  return null;
}

/** Primeira etapa com problema, para o botão final levar a pessoa até o campo que falta. */
export function firstSaleProblem(draft: SaleDraft): StageProblem | null {
  for (let stage = SALE_STAGE.vehicle; stage <= SALE_STAGE.seller; stage += 1) {
    const message = validateSaleStage(stage, draft);
    if (message) return { stage, message };
  }
  return null;
}

function paymentProblem(total: number, payments: ContractPaymentItem[]): string | null {
  if (!(total > 0)) return "Informe o valor total negociado.";
  if (!payments.length) return "Escolha pelo menos uma forma de pagamento.";
  for (const payment of payments) {
    if (payment.method === "financiamento" && !payment.installments) return "Financiamento: informe o número de parcelas.";
    if (payment.method === "cartao" && !payment.installments) return "Cartão: informe o número de parcelas.";
    if (payment.method === "troca" && (!payment.tradeVehicle?.trim() || !payment.tradePlate?.trim())) return "Troca: informe o veículo e a placa.";
    if (payment.amount <= 0) return "Informe o valor de cada forma de pagamento escolhida.";
  }
  const diff = moneyDifference(total, sumContractPayments(payments));
  if (Math.abs(diff) > 0.001) {
    return diff > 0
      ? `Faltam ${formatAdminMoney(diff)} para fechar o total de ${formatAdminMoney(total)}.`
      : `Os pagamentos passam ${formatAdminMoney(-diff)} do total de ${formatAdminMoney(total)}.`;
  }
  return null;
}
