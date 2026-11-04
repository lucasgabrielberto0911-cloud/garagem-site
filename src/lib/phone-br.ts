/**
 * Telefone brasileiro do visitante (formulários públicos e chat).
 * Aceita DDD + 8 ou 9 dígitos, com ou sem o código 55. Devolve só os dígitos nacionais.
 */
export function normalizeBrazilPhone(value: unknown): string | null {
  let digits = String(value ?? "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99 || digits[0] === "0") return null;
  // Celular tem 9 depois do DDD; fixo tem 10 dígitos e começa em 2 a 5.
  if (digits.length === 11 && digits[2] !== "9") return null;
  if (digits.length === 10 && !/[2-5]/.test(digits[2]!)) return null;
  return digits;
}
