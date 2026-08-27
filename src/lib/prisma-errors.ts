/** Prisma P2022: coluna do schema ainda não existe no banco. */
export function isMissingColumnError(error: unknown, column?: string) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code) : "";
  if (code !== "P2022") return false;
  if (!column) return true;
  const meta = "meta" in error ? (error as { meta?: { column?: string } }).meta : undefined;
  const name = meta?.column ?? "";
  return !name || name.includes(column);
}
