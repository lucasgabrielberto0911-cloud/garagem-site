import { formatNumberBR } from "./format";

export type ComparisonMetric = "price" | "yearModel" | "km";

/** Diferença de dados cadastrados; sem classificação de condição ou qualidade. */
export function comparisonDifference(metric: ComparisonMetric, value: number, reference: number): string | null {
  if (!Number.isFinite(value) || !Number.isFinite(reference)) return null;
  if (metric === "price") {
    if (value <= 0 || reference <= 0) return null;
    const cents = Math.round(value * 100) - Math.round(reference * 100);
    if (!cents) return null;
    const digits = cents % 100 === 0 ? 0 : 2;
    const amount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(cents) / 100);
    return `${amount} a ${cents < 0 ? "menos" : "mais"}`;
  }
  if (!Number.isInteger(value) || !Number.isInteger(reference) || value < 0 || reference < 0) return null;
  const difference = value - reference;
  if (!difference || (metric === "yearModel" && (!value || !reference))) return null;
  const amount = Math.abs(difference);
  if (metric === "km") return `${formatNumberBR(amount)} km a ${difference < 0 ? "menos" : "mais"}`;
  return `Modelo ${amount} ${amount === 1 ? "ano" : "anos"} ${difference > 0 ? "mais recente" : "mais antigo"}`;
}

export function differentComparisonText(value: string, reference: string) {
  const normalize = (text: string) => text.trim().toLocaleLowerCase("pt-BR");
  return value !== "—" && reference !== "—" && normalize(value) !== normalize(reference);
}
