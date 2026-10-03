/** Valores em reais na entrada; centavos inteiros durante os cálculos. */
export function parseMoneyBR(value: unknown): number | null {
  const text = String(value ?? "")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "");
  if (!text) return null;
  if (!/^-?\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(text)) return null;
  const amount = Number(text.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(amount) && Math.abs(amount) <= 999999999
    ? Math.round(amount * 100) / 100
    : null;
}
export function moneyInput(value: number | null | undefined) {
  return value == null
    ? ""
    : new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
}
export function moneyTyping(value: string) {
  return value.replace(/[^0-9.,]/g, "");
}
export function moneySum(values: number[]) {
  return values.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
}
export function moneyDifference(a: number, b: number) {
  return (Math.round(a * 100) - Math.round(b * 100)) / 100;
}

export function formatAdminMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
