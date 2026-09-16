/** Ações em lote do estoque: só disponível/vendido, com teto seguro. */

export const ADMIN_BULK_STATUSES = ["disponivel", "vendido"] as const;
export type AdminBulkStatus = (typeof ADMIN_BULK_STATUSES)[number];
export const ADMIN_BULK_MAX = 20;

export function isAdminBulkStatus(value: string): value is AdminBulkStatus {
  return value === "disponivel" || value === "vendido";
}

export function normalizeBulkVehicleIds(
  ids: string[],
  max = ADMIN_BULK_MAX,
) {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
    if (unique.length >= max) break;
  }
  return unique;
}

export function bulkStatusLabel(status: AdminBulkStatus, count: number) {
  if (status === "vendido") {
    return count === 1
      ? "Marcar 1 veículo como vendido"
      : `Marcar ${count} veículos como vendidos`;
  }
  return count === 1
    ? "Marcar 1 veículo como disponível"
    : `Marcar ${count} veículos como disponíveis`;
}

/** Desfazer só a venda em lote — volta para disponível, sem inventar reservado. */
export function canUndoBulkStatus(status: AdminBulkStatus) {
  return status === "vendido";
}

export function bulkUndoStatus(status: AdminBulkStatus): AdminBulkStatus | null {
  return canUndoBulkStatus(status) ? "disponivel" : null;
}

export function bulkUndoLabel(status: AdminBulkStatus, count: number) {
  if (!canUndoBulkStatus(status)) return null;
  return count === 1
    ? "Desfazer: voltar 1 para disponível"
    : `Desfazer: voltar ${count} para disponível`;
}
