/**
 * Regras e funções auxiliares para conciliação e integridade do campo soldAt em veículos.
 */

export type VehicleWithOptionalSale = {
  id?: string;
  status: string;
  soldAt?: Date | null;
  updatedAt?: Date | null;
  createdAt?: Date | null;
  sale?: {
    saleDate?: Date | null;
    soldAt?: Date | null;
    createdAt?: Date | null;
  } | null;
};

/**
 * Determina a ação necessária para reconciliar o soldAt de um veículo:
 * - "set": veículo com status "VENDIDO" que está com soldAt nulo.
 * - "clear": veículo com status diferente de "VENDIDO" que possui soldAt preenchido.
 * - "none": veículo já com estado consistente.
 */
export function getReconciliationAction(vehicle: {
  status: string;
  soldAt?: Date | null;
}): "set" | "clear" | "none" {
  if (vehicle.status === "VENDIDO") {
    return vehicle.soldAt == null ? "set" : "none";
  }
  return vehicle.soldAt != null ? "clear" : "none";
}

/**
 * Resolve a data de venda para um veículo com base na venda vinculada ou datas de fallback.
 * Prioridade: Sale.saleDate -> Sale.soldAt -> Sale.createdAt -> Vehicle.updatedAt -> now.
 */
export function resolveSoldAtDate(vehicle: {
  updatedAt?: Date | null;
  createdAt?: Date | null;
  sale?: {
    saleDate?: Date | null;
    soldAt?: Date | null;
    createdAt?: Date | null;
  } | null;
}): Date {
  if (vehicle.sale?.saleDate) return new Date(vehicle.sale.saleDate);
  if (vehicle.sale?.soldAt) return new Date(vehicle.sale.soldAt);
  if (vehicle.sale?.createdAt) return new Date(vehicle.sale.createdAt);
  if (vehicle.updatedAt) return new Date(vehicle.updatedAt);
  if (vehicle.createdAt) return new Date(vehicle.createdAt);
  return new Date();
}

/**
 * Verifica se o status do veículo representa um veículo vendido.
 */
export function isSoldStatus(status?: string | null): boolean {
  if (!status) return false;
  const s = status.trim().toUpperCase();
  return s === "VENDIDO";
}

/**
 * Regra de negócio da Garagem: carro vendido nunca exibe preço.
 * Retorna se o preço deve ser ocultado para exibição pública ou relatórios.
 */
export function shouldHidePriceForStatus(status?: string | null): boolean {
  return isSoldStatus(status);
}
