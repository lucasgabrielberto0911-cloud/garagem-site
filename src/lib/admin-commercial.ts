import { moneyDifference, moneySum } from "./admin-money";

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

export function suggestPrice(input: { price: number; fipe: number | null; purchase: number | null; costs: number; days: number; margin: number; consigned: boolean }) {
  if (input.consigned || input.purchase == null || input.purchase <= 0) return null;
  const floor = moneySum([input.purchase, input.costs, input.margin]);
  const reduction = input.days >= 90 ? 0.05 : input.days >= 60 ? 0.03 : input.days >= 30 ? 0.01 : 0;
  const market = input.fipe && input.fipe > 0 ? Math.min(input.price, input.fipe) : input.price;
  const price = Math.round(Math.max(floor, market * (1 - reduction)) * 100) / 100;
  return { price, floor, difference: moneyDifference(price, input.price) };
}

export function afterSaleMessage(kind: string, name: string, vehicle: string, googleUrl?: string | null) {
  const greeting = `Oi, ${name}!`;
  if (kind === "entrega") return `Parabéns, ${name}! O seu ${vehicle} já está com você. Obrigado por confiar na Garagem! Se precisar de ajuda depois da compra, estou por aqui.`;
  if (kind === "satisfacao") return `${greeting} Passaram 7 dias da entrega. Está tudo certo com o ${vehicle}? Se precisar de ajuda, fala comigo.${googleUrl ? ` Se puder, deixe uma avaliação no Google para ajudar a Garagem: ${googleUrl}` : ""}`;
  if (kind === "documentacao") return `${greeting} Já passou um mês desde a compra do ${vehicle}. Se tiver alguma dúvida sobre documentação, contrato, pagamento ou quitação, me chama. — Garagem`;
  return `${greeting} Lembrete de manutenção: por volta de 6 meses ou 10 mil km, vale conferir a revisão do ${vehicle} — óleo, filtros, pneus, freios e fluidos. O manual do veículo é a referência. — Garagem`;
}
