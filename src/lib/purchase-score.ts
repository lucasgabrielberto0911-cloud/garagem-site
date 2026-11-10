import type { PurchaseInput } from "./purchase-input";
import type { PurchaseSimulation } from "./purchase-simulator";

export const PURCHASE_SCORE_VERSION = "1.0.0";
const clamp = (n: number) => Math.max(0, Math.min(1, n));
type Range = { min: number; max: number; known: number; reason: string; evidenceIds: string[] };
const presence = (state: PurchaseInput["manual"]) => state === "desconhecido" ? { min: 0, max: 100, known: 0 } : { min: state === "verificado" ? 100 : 0, max: state === "verificado" ? 100 : 0, known: 1 };

/** Pesos faltantes permanecem abertos: não redistribuir para inflar a nota. */
export function scorePurchase(input: PurchaseInput, result: PurchaseSimulation, now = new Date()) {
  const p = result.parameters.score;
  const normal = result.scenarios.find(s => s.key === "normal")?.calculation;
  const adverse = result.scenarios.find(s => s.key === "demorada")?.calculation;
  const finance = normal && adverse ? 100 * (0.7 * clamp(normal.resultCents / (normal.targetCents > 0 ? normal.targetCents : p.scaleTargetCents)) + 0.3 * clamp(adverse.resultCents / (adverse.targetCents > 0 ? adverse.targetCents : p.scaleTargetCents))) : null;
  const blockers: string[] = [];
  if (!input.identity.confirmed) blockers.push("Identidade, versão, ano e câmbio ainda não confirmados.");
  if (input.inspection === "reprovado") blockers.push("Laudo reprovado exige análise antes da compra.");
  if (input.restriction === "grave") blockers.push("Restrição relevante não resolvida.");
  if (Object.values(input.conditions).some(c => c.state === "grave")) blockers.push("Problema relevante sem diagnóstico/orçamento.");
  if (input.conditions.mecanica.state === "desconhecido") blockers.push("Mecânica desconhecida: faça o diagnóstico antes de recomendar a compra.");
  if (result.missing.length) blockers.push(...result.missing);
  const fresh = (date: string, days: number) => Boolean(date && (now.getTime() - Date.parse(date)) / 86400000 <= days && Date.parse(date) <= now.getTime());
  const liquidityKnown = input.liquidity.verified && input.liquidity.days !== null && (input.liquidity.sampleCount ?? 0) >= 5 && (input.liquidity.effectiveSampleSize ?? 0) >= 3 && fresh(input.liquidity.date, 365);
  const liquidity = liquidityKnown ? p.liquidityBands.find(b => input.liquidity.days! <= b.maxDays)?.points ?? p.liquidityBeyondPoints : null;
  const conditionParts = Object.values(input.conditions).map(c => c.state === "desconhecido" ? { min: 0, max: 100, known: 0 } : { min: c.state === "grave" ? 0 : c.state === "orcado" ? 70 : 100, max: c.state === "grave" ? 40 : c.state === "orcado" ? 70 : 100, known: 1 });
  const condition = { min: conditionParts.reduce((s, c) => s + c.min, 0) / conditionParts.length, max: conditionParts.reduce((s, c) => s + c.max, 0) / conditionParts.length, known: conditionParts.reduce((s, c) => s + c.known, 0) / conditionParts.length };
  const doc = input.inspectionVerified && input.restriction === "resolvida" ? input.inspection === "aprovado" ? 100 : input.inspection === "apontamentos" && input.conditions.documentacao.state === "orcado" ? 60 : input.inspection === "reprovado" ? 0 : null : null;
  const completeness = { min: 0, max: 0, known: 0 };
  for (const key of ["manual", "spareKey", "maintenanceHistory"] as const) { const range = presence(input[key]); for (const field of ["min", "max", "known"] as const) completeness[field] += range[field] * p.completeness[key]; }
  const ranges: Record<keyof typeof p.weights, Range> = {
    financeiro: { min: finance ?? 0, max: finance ?? 100, known: finance === null ? 0 : 1, reason: "70% do atingimento da meta normal e 30% da adversa, no preço pedido.", evidenceIds: ["motor:normal", "motor:demorada"] },
    liquidez: { min: liquidity ?? 0, max: liquidity ?? 100, known: liquidity === null ? 0 : 1, reason: liquidity === null ? "Sem medição verificada e atual; prazo não inferido pela reputação do modelo." : input.liquidity.source, evidenceIds: ["entrada:liquidez"] },
    condicao: { ...condition, reason: "Verificado: 100; reparo orçado: 70; grave: 0–40; desconhecido: 0–100.", evidenceIds: ["entrada:condicoes", "entrada:custos"] },
    documentacao: { min: doc ?? 0, max: doc ?? 100, known: doc === null ? 0 : 1, reason: "Laudo e restrições exigem verificação; apontamentos precisam de orçamento.", evidenceIds: ["entrada:laudo"] },
    completude: { ...completeness, reason: "Manual 20%, chave 40%, histórico 40% dentro dos 5 pontos.", evidenceIds: ["entrada:completude"] },
  };
  const dimensions = Object.entries(ranges).map(([key, range]) => ({ key, ...range, weight: p.weights[key as keyof typeof p.weights], pointsMin: range.min * p.weights[key as keyof typeof p.weights] / 100, pointsMax: range.max * p.weights[key as keyof typeof p.weights] / 100 }));
  const coverage = dimensions.reduce((s, d) => s + d.weight * d.known, 0) / 100;
  const rawMin = dimensions.reduce((s, d) => s + d.pointsMin, 0), rawMax = dimensions.reduce((s, d) => s + d.pointsMax, 0);
  const fullScore = coverage === 1 && Math.abs(rawMin - rawMax) < 1e-8;
  const min = fullScore ? Math.round(rawMin) : Math.floor(rawMin + 1e-8), max = fullScore ? min : Math.ceil(rawMax - 1e-8);
  const resaleVerified = input.resaleEvidence.verified && fresh(input.resaleEvidence.date, 30);
  if (!resaleVerified) blockers.push("Base de revenda manual sem evidência verificada nos últimos 30 dias; ágio não comprovado.");
  const sufficient = coverage >= p.minCoverageForFavorable && resaleVerified && input.inspectionVerified && doc !== null;
  const verdict: "pendente" | "nao_atende" | "atencao" | "compensa" = blockers.length || !normal || !adverse ? "pendente" : !result.policyPassed ? "nao_atende" : !sufficient ? "atencao" : normal.resultCents < 0 ? "nao_atende" : min >= p.bands.boa ? "compensa" : "atencao";
  const costsVerified = input.costs.every(c => ["incluido", "nao_se_aplica"].includes(c.status) || (c.status === "ok" && c.source !== "premissa" && Boolean(c.date)));
  const confidence: "alta" | "media" | "baixa" = sufficient && coverage === 1 && liquidityKnown && costsVerified ? "alta" : coverage >= 0.6 && resaleVerified ? "media" : "baixa";
  return { scoreVersion: PURCHASE_SCORE_VERSION, min, max, partial: min, total: coverage === 1 && min === max ? min : null, coverage, confidence, verdict, band: min >= p.bands.forte ? "forte" : min >= p.bands.boa ? "boa com condições" : min >= p.bands.atencao ? "atenção" : "fraca", dimensions, blockers, explanation: result.policyPassed ? "O preço atende às metas financeiras configuradas. A recomendação depende também das evidências e pendências." : normal && adverse && normal.resultCents > 0 && adverse.resultCents > 0 ? "Há contribuição positiva, mas a meta não é atingida em todos os cenários. Isso não significa prejuízo." : "Confira o resultado de cada cenário e as pendências antes de decidir." };
}
export type PurchaseScore = ReturnType<typeof scorePurchase>;
