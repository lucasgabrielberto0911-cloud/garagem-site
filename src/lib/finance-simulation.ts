/**
 * Simulador de financiamento da ficha. Resultado é só estimativa:
 * a taxa abaixo é de referência, não é oferta e depende de aprovação de crédito.
 */
export const FINANCE_REFERENCE_RATE_MONTHLY = 0.0199;
export const FINANCE_INSTALLMENT_OPTIONS = [12, 24, 36, 48, 60] as const;
export const FINANCE_DISCLAIMER =
  "Estimativa sujeita a aprovação de crédito. Taxa de referência de 1,99% ao mês, sem tarifas; a taxa real pode variar.";

export type FinanceSimulation = {
  down: number;
  financed: number;
  months: number;
  installment: number;
  rateMonthly: number;
};

/** Parcela pela tabela Price. Entrada é limitada a 0..preço. */
export function simulateFinance(input: {
  price: number;
  down: number;
  months: number;
  rateMonthly?: number;
}): FinanceSimulation | null {
  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const months = Math.round(input.months);
  if (!Number.isFinite(months) || months < 1) return null;
  const rate = input.rateMonthly ?? FINANCE_REFERENCE_RATE_MONTHLY;
  const down = Math.min(Math.max(Number(input.down) || 0, 0), price);
  const financed = price - down;
  if (financed <= 0) {
    return { down, financed: 0, months, installment: 0, rateMonthly: rate };
  }
  const installment =
    rate > 0
      ? (financed * rate) / (1 - Math.pow(1 + rate, -months))
      : financed / months;
  return {
    down,
    financed,
    months,
    installment: Math.round(installment * 100) / 100,
    rateMonthly: rate,
  };
}

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Mensagem pronta para o WhatsApp com os valores simulados. */
export function financeWhatsAppMessage(input: {
  label: string;
  price: number;
  simulation: FinanceSimulation;
  isMoto?: boolean;
}) {
  const { simulation: s } = input;
  const article = input.isMoto ? "a" : "o";
  const label = input.label.replace(/\s+/g, " ").trim();
  return (
    `Oi! Simulei o financiamento ${label ? `d${article} ${label} ` : ""}no site da Garagem: ` +
    `valor ${brl(input.price)}, entrada ${brl(s.down)}, ${s.months}x de cerca de ${brl(s.installment)} ` +
    `(estimativa, sujeita a aprovação de crédito). Pode me ajudar com a proposta?`
  );
}
