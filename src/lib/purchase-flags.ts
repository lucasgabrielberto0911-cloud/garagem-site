/**
 * Flags do avaliador de compra. Todas desligadas por padrão: produção só ativa
 * depois de aplicar a migration 20261110150000_avaliador_de_compra.
 */
function enabled(name: string) {
  const value = (process.env[name] ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on";
}

/** Tela /admin/compra e rotas /api/admin/compra. */
export function isPurchaseEvaluatorEnabled() {
  return enabled("PURCHASE_EVALUATOR_ENABLED");
}

/** Consulta externa do histórico FIPE (tabelafipe.info). Desligada = só FIPE manual com origem declarada. */
export function isFipeHistoryEnabled() {
  return enabled("PURCHASE_FIPE_HISTORY_ENABLED");
}
