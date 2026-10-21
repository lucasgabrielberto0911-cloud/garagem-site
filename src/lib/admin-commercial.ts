import { formatAdminMoney, moneyDifference, moneySum } from "./admin-money";

export type ContractPaymentMethod = "pix" | "financiamento" | "troca" | "cartao" | "sinal";

export const CONTRACT_PAYMENT_METHODS: { id: ContractPaymentMethod; label: string }[] = [
  { id: "pix", label: "À vista/PIX" },
  { id: "financiamento", label: "Financiamento" },
  { id: "troca", label: "Troca (carro na troca)" },
  { id: "cartao", label: "Cartão" },
  { id: "sinal", label: "Sinal" },
];

export type ContractPaymentItem = {
  method: ContractPaymentMethod;
  amount: number;
  bank?: string;
  downPayment?: number;
  installments?: number;
  tradeVehicle?: string;
  tradePlate?: string;
  signalDate?: string;
};

export function formatContractPaymentRow(item: ContractPaymentItem, receiptRef?: string): string {
  switch (item.method) {
    case "sinal": {
      if (receiptRef) return `(−) Sinal já pago — ${receiptRef}, abatido do preço`;
      const dateStr = item.signalDate
        ? (/^\d{4}-\d{2}-\d{2}/.test(item.signalDate)
          ? item.signalDate.slice(0, 10).split("-").reverse().join("/")
          : item.signalDate)
        : "";
      return `(−) Sinal já pago${dateStr ? ` (${dateStr})` : ""} — recibo de sinal emitido pela VENDEDORA, abatido do preço`;
    }
    case "pix":
      return "(−) À vista / PIX";
    case "financiamento": {
      const details = [
        item.bank ? item.bank : "",
        item.installments ? `${item.installments}x` : "",
      ].filter(Boolean).join(", ");
      return `(−) Financiamento${details ? ` (${details})` : ""} — valor financiado`;
    }
    case "troca": {
      const details = [
        item.tradeVehicle ? item.tradeVehicle : "",
        item.tradePlate ? `placa ${item.tradePlate}` : "",
      ].filter(Boolean).join(" · ");
      return `(−) Troca — veículo na troca${details ? ` (${details})` : ""}`;
    }
    case "cartao":
      return `(−) Cartão${item.installments ? ` (${item.installments}x)` : ""}`;
  }
}

export function summarizeContractPayments(items: ContractPaymentItem[]): string {
  const parts = items.filter((item) => item.amount > 0).map((item) => {
    const val = formatAdminMoney(item.amount);
    switch (item.method) {
      case "pix":
        return `À vista/PIX (${val})`;
      case "financiamento": {
        const extra = [
          item.bank || "",
          item.installments ? `${item.installments}x` : "",
          item.downPayment && item.downPayment > 0 ? `entrada ${formatAdminMoney(item.downPayment)}` : "",
        ].filter(Boolean).join(" ");
        return `Financiamento${extra ? ` ${extra}` : ""} (${val})`;
      }
      case "troca": {
        const extra = [item.tradeVehicle || "", item.tradePlate || ""].filter(Boolean).join(" ");
        return `Troca${extra ? ` ${extra}` : ""} (${val})`;
      }
      case "cartao":
        return `Cartão${item.installments ? ` ${item.installments}x` : ""} (${val})`;
      case "sinal":
        return `Sinal (${val})`;
    }
  });
  return (parts.join(" + ") || "À vista/PIX").slice(0, 200);
}

export function parseContractPaymentsJson(raw: string): ContractPaymentItem[] | undefined {
  if (!raw.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  const validMethods = new Set<string>(CONTRACT_PAYMENT_METHODS.map((m) => m.id));
  const result: ContractPaymentItem[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const method = String(obj.method ?? "");
    const amount = Number(obj.amount ?? 0);
    if (!validMethods.has(method) || !Number.isFinite(amount) || amount < 0) continue;
    const item: ContractPaymentItem = {
      method: method as ContractPaymentMethod,
      amount: Math.round(amount * 100) / 100,
    };
    if (typeof obj.bank === "string" && obj.bank.trim()) item.bank = obj.bank.trim().slice(0, 160);
    if (typeof obj.downPayment === "number" && Number.isFinite(obj.downPayment) && obj.downPayment > 0) {
      item.downPayment = Math.round(obj.downPayment * 100) / 100;
    }
    if (typeof obj.installments === "number" && Number.isInteger(obj.installments) && obj.installments > 0 && obj.installments <= 120) {
      item.installments = obj.installments;
    }
    if (typeof obj.tradeVehicle === "string" && obj.tradeVehicle.trim()) item.tradeVehicle = obj.tradeVehicle.trim().slice(0, 120);
    if (typeof obj.tradePlate === "string" && obj.tradePlate.trim()) item.tradePlate = obj.tradePlate.trim().slice(0, 16);
    if (typeof obj.signalDate === "string" && obj.signalDate.trim()) item.signalDate = obj.signalDate.trim().slice(0, 32);
    if (item.amount > 0 || (item.downPayment && item.downPayment > 0)) {
      result.push(item);
    }
  }
  return result.length > 0 ? result : undefined;
}

export function sumContractPayments(items: ContractPaymentItem[]): number {
  return moneySum(items.flatMap((item) => {
    const list = [item.amount > 0 ? item.amount : 0];
    if (item.method === "financiamento" && item.downPayment && item.downPayment > 0) {
      list.push(item.downPayment);
    }
    return list;
  }));
}

export const ENTRY_ITEMS = ["Pneus", "Freios", "Suspensão", "Motor", "Câmbio", "Fluidos", "Lataria", "Pintura", "Interior", "Elétrica", "Documentação", "Laudo cautelar", "Chave reserva", "Manual"] as const;
export const FINANCE_STATUSES = ["simulacao", "enviada", "aprovada", "recusada"] as const;
export const AFTER_SALE = [
  { kind: "entrega", days: 0, label: "Entrega" },
  { kind: "satisfacao", days: 7, label: "Satisfação e avaliação Google" },
  { kind: "documentacao", days: 30, label: "Documentação" },
  { kind: "revisao", days: 180, label: "Revisão" },
] as const;

export function simulateFinancing(price: number, down: number, rate: number, months: number) {
  if (![price, down, rate, months].every(Number.isFinite) || price <= 0 || down < 0 || down >= price || rate < 0 || rate > 10 || !Number.isInteger(months) || months < 1 || months > 120) throw new Error("Informe valor, entrada, taxa mensal de 0 a 10% e prazo de 1 a 120 meses.");
  const principal = moneyDifference(price, down);
  const interest = rate / 100;
  const installment = Math.round((interest === 0 ? principal / months : principal * interest / (1 - Math.pow(1 + interest, -months))) * 100) / 100;
  return { principal, installment, total: moneySum([down, installment * months]), interest: moneyDifference(installment * months, principal) };
}

export function suggestPrice(input: { price: number; purchase: number | null; costs: number; days: number; margin: number; consigned: boolean }) {
  if (input.consigned || input.purchase == null || input.purchase <= 0) return null;
  const floor = moneySum([input.purchase, input.costs, input.margin]);
  const reduction = input.days >= 90 ? 0.05 : input.days >= 60 ? 0.03 : input.days >= 30 ? 0.01 : 0;
  const price = Math.round(Math.max(floor, input.price * (1 - reduction)) * 100) / 100;
  return { price, floor, difference: moneyDifference(price, input.price) };
}

export function afterSaleMessage(kind: string, name: string, vehicle: string, googleUrl?: string | null) {
  const greeting = `Oi, ${name}!`;
  if (kind === "entrega") return `Parabéns, ${name}! O seu ${vehicle} já está com você. Obrigado por confiar na Garagem! Se precisar de ajuda depois da compra, estou por aqui.`;
  if (kind === "satisfacao") return `${greeting} Passaram 7 dias da entrega. Está tudo certo com o ${vehicle}? Se precisar de ajuda, fala comigo.${googleUrl ? ` Se puder, deixe uma avaliação no Google para ajudar a Garagem: ${googleUrl}` : ""}`;
  if (kind === "documentacao") return `${greeting} Já passou um mês desde a compra do ${vehicle}. Se tiver alguma dúvida sobre documentação, contrato, pagamento ou quitação, me chama. — Garagem`;
  return `${greeting} Lembrete de manutenção: por volta de 6 meses ou 10 mil km, vale conferir a revisão do ${vehicle} — óleo, filtros, pneus, freios e fluidos. O manual do veículo é a referência. — Garagem`;
}

/** Com sinal persistido (recibo da reserva), a lista de pagamentos deve trazer exatamente esse sinal. */
export function signalMismatch(items: ContractPaymentItem[], signalAmount: number): string | undefined {
  const listed = moneySum(items.filter((i) => i.method === "sinal").map((i) => i.amount));
  if (signalAmount > 0 && Math.abs(listed - signalAmount) > 0.01) {
    return `O sinal nas formas de pagamento (${formatAdminMoney(listed)}) deve ser igual ao sinal já pago (${formatAdminMoney(signalAmount)}).`;
  }
  return undefined;
}

/** Entrada equivalente para a simulação: tudo que não é financiado (total − valor financiado). */
export function financingSimulationDown(total: number, items: ContractPaymentItem[]): number | undefined {
  const financed = moneySum(items.filter((i) => i.method === "financiamento").map((i) => i.amount));
  return financed > 0 && financed < total ? moneyDifference(total, financed) : undefined;
}

/** Normaliza e valida chassi (17 alfanuméricos), RENAVAM (11 dígitos) e RG (até 20 caracteres). Vazio é permitido. */
export function parseVehicleCustomerIds(input: { chassis?: string; renavam?: string; rg?: string }): { chassis: string; renavam: string; rg: string; error?: string } {
  const chassis = (input.chassis ?? "").replace(/[\s.-]/g, "").toUpperCase();
  const renavam = (input.renavam ?? "").replace(/\D/g, "");
  const rg = (input.rg ?? "").trim();
  let error: string | undefined;
  if (chassis && !/^[A-Z0-9]{17}$/.test(chassis)) error = "Chassi deve ter 17 caracteres (letras e números).";
  else if (renavam && renavam.length !== 11) error = "RENAVAM deve ter 11 dígitos.";
  else if (rg.length > 20) error = "RG deve ter até 20 caracteres.";
  return { chassis, renavam, rg, error };
}
