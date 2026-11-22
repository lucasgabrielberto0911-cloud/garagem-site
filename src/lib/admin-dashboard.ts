/** Resumos da Central da loja — sem prisma, testável. */
import { moneySum } from "@/lib/admin-money";
import {
  expectedMargin,
  hasCostBasis,
  investedTotal,
} from "@/lib/vehicle-ops";

export type StockCapitalVehicleInput = {
  price: number;
  purchasePrice: number | null | undefined;
  consigned: boolean;
  km: number;
  costsTotal: number;
  status?: string;
  historical?: boolean | null;
};

export type StockCapitalSummary = {
  activeCount: number;
  ownedCount: number;
  consignedCount: number;
  stockValue: number;
  investedTotal: number;
  potentialProfit: number;
  withCostBasisCount: number;
  missingPurchaseCount: number;
  averagePrice: number;
  averageKm: number;
};

/**
 * Soma (preço - compra - custos) dos veículos disponíveis e reservados
 * com preço de compra informado, excluindo consignados.
 */
export function summarizeStockCapital(
  vehicles: readonly StockCapitalVehicleInput[],
): StockCapitalSummary {
  let activeCount = 0;
  let ownedCount = 0;
  let consignedCount = 0;
  let totalKm = 0;
  let kmCount = 0;
  const saleValues: number[] = [];
  const investedValues: number[] = [];
  const profitValues: number[] = [];
  let withCostBasisCount = 0;
  let missingPurchaseCount = 0;

  for (const vehicle of vehicles) {
    if (vehicle.historical === true) continue;
    if (
      vehicle.status &&
      vehicle.status !== "disponivel" &&
      vehicle.status !== "reservado"
    ) {
      continue;
    }

    activeCount += 1;
    if (vehicle.km > 0) {
      totalKm += vehicle.km;
      kmCount += 1;
    }

    if (vehicle.consigned) {
      consignedCount += 1;
      continue;
    }

    ownedCount += 1;
    if (vehicle.price > 0) {
      saleValues.push(vehicle.price);
    }

    const hasPurchase = hasCostBasis(vehicle.purchasePrice, vehicle.costsTotal);
    if (!hasPurchase) {
      missingPurchaseCount += 1;
      continue;
    }

    const invested = investedTotal(vehicle.purchasePrice, vehicle.costsTotal, {
      consigned: false,
    });
    if (invested > 0) {
      investedValues.push(invested);
    }

    if (vehicle.price > 0) {
      withCostBasisCount += 1;
      profitValues.push(
        expectedMargin(vehicle.price, vehicle.purchasePrice, vehicle.costsTotal),
      );
    }
  }

  const stockValue = moneySum(saleValues);
  return {
    activeCount,
    ownedCount,
    consignedCount,
    stockValue,
    investedTotal: moneySum(investedValues),
    potentialProfit: moneySum(profitValues),
    withCostBasisCount,
    missingPurchaseCount,
    averagePrice: saleValues.length > 0 ? stockValue / saleValues.length : 0,
    averageKm: kmCount > 0 ? totalKm / kmCount : 0,
  };
}
