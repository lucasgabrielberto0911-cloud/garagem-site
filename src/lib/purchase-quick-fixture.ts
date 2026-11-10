import { newQuickPurchase } from "./purchase-quick";

export function quickFixture() {
  return { ...newQuickPurchase(), plate: "ABC1D23", identity: { brand: "Honda", model: "Fit", version: "Fit EX", modelYear: 2018, fuel: "Flex", transmission: "Automático", confirmed: true }, askedPriceCents: 5_000_000, fipe: { provider: "manual" as const, code: "", referenceMonth: "2026-11", valueCents: 7_000_001, source: "Fixture fictícia", fuelDecision: "" } };
}
