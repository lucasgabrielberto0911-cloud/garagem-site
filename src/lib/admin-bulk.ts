/** Ações em lote do estoque: só disponível/vendido, com teto seguro. */

export const ADMIN_BULK_STATUSES = ["disponivel", "vendido"] as const;
export type AdminBulkStatus = (typeof ADMIN_BULK_STATUSES)[number];
export const ADMIN_BULK_MAX = 20;
export const ADMIN_BULK_NAME_PREVIEW = 6;

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

/** Na aba Vendidos o lote só devolve ao estoque — vender de novo não faz sentido. */
export function bulkActionsForTab(tab: string): AdminBulkStatus[] {
  if (tab === "vendidos") return ["disponivel"];
  return ["disponivel", "vendido"];
}

export function idsNeedingBulkStatus<T extends { id: string; status: string }>(
  items: T[],
  selected: string[],
  status: AdminBulkStatus,
) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return selected.filter((id) => {
    const item = byId.get(id);
    return Boolean(item && item.status !== status);
  });
}

export function bulkNamePreview<
  T extends { id: string; brand: string; model: string },
>(items: T[], ids: string[], max = ADMIN_BULK_NAME_PREVIEW) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const names = ids
    .map((id) => byId.get(id))
    .filter((item): item is T => Boolean(item))
    .map((item) => `${item.brand} ${item.model}`);
  if (names.length === 0) return "";
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} e mais ${names.length - max}`;
}

export function bulkFeaturedLeavingHome<
  T extends { id: string; featured?: boolean },
>(items: T[], ids: string[], status: AdminBulkStatus) {
  if (status !== "vendido") return 0;
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.filter((id) => byId.get(id)?.featured).length;
}

export function bulkConfirmDescription(input: {
  status: AdminBulkStatus;
  count: number;
  names: string;
  featuredLeaving: number;
}) {
  const names = input.names ? ` ${input.names}.` : "";
  if (input.status === "vendido") {
    const home =
      input.featuredLeaving > 0
        ? ` ${input.featuredLeaving} sai${input.featuredLeaving === 1 ? "" : "em"} da home.`
        : "";
    return `Confirmar venda de ${input.count} veículo(s)?${names} Saem do estoque ativo.${home} As páginas públicas continuam no ar com aviso (sem 404, sem sync de Marketplace).`;
  }
  return `Voltar ${input.count} veículo(s) para disponível no site?${names}`;
}
