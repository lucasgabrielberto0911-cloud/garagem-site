import { cents, MAX_CENTS, PurchaseError, type PurchaseInput } from "./purchase-input";
import { DEFAULT_PURCHASE_POLICY, SCENARIO_KEYS, type PurchasePolicy } from "./purchase-policy";

export const PURCHASE_ENGINE_VERSION = "1.0.0";
type ScenarioInput = { resaleCents: number; fixedCents: number; upfrontCents: number; purchaseCents: number; targetCents: number; proportionalRate: number; monthlyCapitalRate: number; days: number };
const RATE_SCALE = BigInt(100_000_000), ZERO = BigInt(0), ONE = BigInt(1);
const floorDiv = (n: bigint, d: bigint) => n / d - (n < ZERO && n % d !== ZERO ? ONE : ZERO);
const ceilDiv = (n: bigint, d: bigint) => -floorDiv(-n, d);
function rateUnits(rate: number) {
  const units = Math.round(rate * Number(RATE_SCALE));
  if (rate !== units / Number(RATE_SCALE)) throw new PurchaseError("Use até oito casas decimais nas taxas.");
  return BigInt(units);
}

/** Fronteiras monetárias: despesas para cima, receita/teto para baixo. */
export function calculatePurchaseScenario(i: ScenarioInput) {
  for (const key of ["resaleCents", "fixedCents", "upfrontCents", "purchaseCents"] as const) cents(i[key], key);
  if (!Number.isSafeInteger(i.targetCents) || Math.abs(i.targetCents) > MAX_CENTS || !Number.isInteger(i.days) || i.days < 1 || i.days > 3650 || ![i.proportionalRate, i.monthlyCapitalRate].every(v => Number.isFinite(v) && v >= 0 && v < 1) || !i.resaleCents) throw new PurchaseError("Parâmetros financeiros inválidos.");
  const capitalFactor = i.monthlyCapitalRate * i.days / 30;
  const q = rateUnits(i.proportionalRate), capitalNumerator = rateUnits(i.monthlyCapitalRate) * BigInt(i.days), capitalDenominator = RATE_SCALE * BigInt(30);
  const proportionalCents = Number(ceilDiv(BigInt(i.resaleCents) * q, RATE_SCALE));
  const capitalCents = Number(ceilDiv(BigInt(i.purchaseCents) * capitalNumerator, capitalDenominator));
  const resultCents = i.resaleCents - proportionalCents - i.fixedCents - i.purchaseCents - capitalCents;
  const ceilingCents = Number(floorDiv(BigInt(i.resaleCents - proportionalCents - i.fixedCents - i.targetCents) * capitalDenominator, capitalDenominator + capitalNumerator));
  const breakEvenResaleCents = Number(ceilDiv(BigInt(i.purchaseCents + capitalCents + i.fixedCents) * RATE_SCALE, RATE_SCALE - q));
  const investedCents = i.purchaseCents + i.upfrontCents;
  const result = { days: i.days, resaleCents: i.resaleCents, fixedCents: i.fixedCents, upfrontCents: i.upfrontCents, proportionalCents, capitalCents, capitalFactor, targetCents: i.targetCents, resultCents, ceilingCents, breakEvenResaleCents, investedCents, margin: resultCents / i.resaleCents, returnOnCapital: investedCents > 0 ? resultCents / investedCents : null };
  if (Object.values(result).some(v => typeof v === "number" && (!Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER))) throw new PurchaseError("Cálculo excede os limites seguros.");
  return result;
}

export function simulatePurchase(input: PurchaseInput, policy: PurchasePolicy = DEFAULT_PURCHASE_POLICY) {
  const p = { ...policy, ...input.parameters };
  const missing = input.costs.filter(c => c.status === "desconhecido").map(c => `Custo desconhecido: ${c.label}; reserva provisória aplicada.`);
  if (!input.resaleEvidence.source || !input.resaleEvidence.date) missing.push("Informe fonte e data da hipótese de revenda.");
  const scenarios = SCENARIO_KEYS.map(key => {
    const config = p.scenarios[key], resaleCents = input.resaleCents[key];
    if (resaleCents === null) { missing.push(`Informe a venda efetiva do cenário ${key}.`); return { key, calculation: null }; }
    let fixedCents = 0, upfrontCents = 0;
    const costs = input.costs.map(c => {
      const valueCents = c.status === "desconhecido" ? (key === "demorada" ? p.unknownCostPlaceholder.maxCents : p.unknownCostPlaceholder.baseCents) : ["nao_se_aplica", "incluido"].includes(c.status) ? 0 : (key === "demorada" ? c.maxCents : c.baseCents)!;
      cents(valueCents, c.label);
      fixedCents += valueCents;
      if (c.upfront !== false) upfrontCents += valueCents;
      return { key: c.key, label: c.label, valueCents, status: c.status, provisional: c.fromProfile || c.status === "desconhecido" || c.source === "premissa" };
    });
    const holdingCents = config.days * p.holdingDailyCents;
    fixedCents += holdingCents;
    const targetCents = key === "demorada" && p.ceilingPolicy === "meta_normal_perda_maxima" ? -p.maxLossCents : p.targetCents;
    return { key, costs, holdingCents, calculation: calculatePurchaseScenario({ resaleCents, fixedCents, upfrontCents, purchaseCents: input.askedPriceCents, targetCents, proportionalRate: p.proportionalRate, monthlyCapitalRate: p.monthlyCapitalRate, days: config.days }) };
  });
  const complete = scenarios.every(s => s.calculation !== null);
  const ceilingCents = complete ? Math.min(...scenarios.map(s => s.calculation!.ceilingCents)) : null;
  const idealCents = ceilingCents !== null && ceilingCents > 0 ? Math.floor((ceilingCents - p.slackCents) / p.stepCents) * p.stepCents : null;
  return { engineVersion: PURCHASE_ENGINE_VERSION, provisional: true, resaleBasis: input.resaleBasis, scenarios, ceilingCents, idealCents: idealCents !== null && idealCents > 0 ? idealCents : null, requiredDiscountCents: ceilingCents === null ? null : Math.max(0, input.askedPriceCents - ceilingCents), policyPassed: complete && ceilingCents! > 0 && input.askedPriceCents <= ceilingCents!, missing, parameters: p, explanation: "Contribuição estimada após os custos configurados. Não é lucro líquido contábil. Venda efetiva futura informada manualmente; desconto e desvalorização não são reaplicados. Retorno usa compra + custos antecipados, excluindo permanência futura e reservas marcadas como não desembolsadas." };
}
export type PurchaseSimulation = ReturnType<typeof simulatePurchase>;
