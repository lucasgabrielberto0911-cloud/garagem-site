/** Telefone nacional com DDD; aceita formatação e o prefixo brasileiro 55. */
export function normalizeAdminPhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? digits : null;
}
