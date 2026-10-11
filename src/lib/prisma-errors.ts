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

/** Prisma P2021: tabela do schema ainda não existe no banco. */
export function isMissingTableError(error: unknown, table?: string) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code) : "";
  if (code !== "P2021") return false;
  if (!table) return true;
  const meta = "meta" in error ? (error as { meta?: { table?: string } }).meta : undefined;
  const name = meta?.table ?? "";
  return !name || name.includes(table);
}
