import { cents, newPurchaseInput, parsePurchaseInput, PurchaseError, type PurchaseInput } from "./purchase-input";
import { DEFAULT_PURCHASE_POLICY, SCENARIO_KEYS, type CostItem, type PurchasePolicy } from "./purchase-policy";

export type DealType = "normal" | "sem_oferta" | "repasse";
export type QuickPurchase = {
  schemaVersion: 2; plate: string; source: PurchaseInput["source"];
  identity: PurchaseInput["identity"]; km: number | null; fipe: PurchaseInput["fipe"];
  askedPriceCents: number; dealType: DealType; inspection: "nao_feito" | "aprovado" | "reprovado"; notes: string;
};
export function newQuickPurchase(): QuickPurchase {
  const input = newPurchaseInput();
  return { schemaVersion: 2, plate: "", source: null, identity: input.identity, km: null, fipe: null, askedPriceCents: 0, dealType: "normal", inspection: "nao_feito", notes: "" };
}
export function parseQuickPurchase(raw: unknown): QuickPurchase {
  if (!raw || typeof raw !== "object") throw new PurchaseError("Entrada curta inválida.");
  const q = raw as QuickPurchase;
  if (q.schemaVersion !== 2 || !["normal", "sem_oferta", "repasse"].includes(q.dealType) || !["nao_feito", "aprovado", "reprovado"].includes(q.inspection) || typeof q.notes !== "string" || q.notes.length > 4000) throw new PurchaseError("Revise o tipo de negócio, laudo e observações.");
  if (typeof q.identity?.brand !== "string" || !q.identity.brand.trim() || typeof q.identity.model !== "string" || !q.identity.model.trim() || !q.identity.modelYear) throw new PurchaseError("Informe ao menos marca, modelo e ano.");
  const base = newPurchaseInput();
  const checked = parsePurchaseInput({ ...base, plate: q.plate, source: q.source, identity: { ...q.identity, confirmed: false }, km: q.km, fipe: q.fipe, askedPriceCents: q.askedPriceCents, title: `${q.identity.brand} ${q.identity.model} ${q.identity.modelYear}`.slice(0, 160) });
  if (typeof q.identity.confirmed !== "boolean") throw new PurchaseError("Confirmação da versão inválida.");
  if (checked.fipe?.provider === "tabelafipe.info" && (!q.identity.confirmed || !checked.identity.version)) throw new PurchaseError("Escolha a versão FIPE para confirmar o veículo.");
  return { schemaVersion: 2, plate: checked.plate, source: checked.source, identity: { ...checked.identity, confirmed: q.identity.confirmed }, km: checked.km, fipe: checked.fipe, askedPriceCents: cents(q.askedPriceCents, "Preço de compra", 1), dealType: q.dealType, inspection: q.inspection, notes: q.notes.trim() };
}
export function quickPolicy(q: QuickPurchase, policy: PurchasePolicy): PurchasePolicy {
  if (q.dealType !== "repasse") return policy;
  // Repasse usa apenas a hipótese rápida publicada, sem inferir giro real da loja.
  return { ...policy, scenarios: Object.fromEntries(SCENARIO_KEYS.map(key => [key, { ...policy.scenarios.rapida }])) as PurchasePolicy["scenarios"] };
}
export function mapQuickPurchase(q: QuickPurchase, items: CostItem[], policy = DEFAULT_PURCHASE_POLICY): PurchaseInput {
  const input = newPurchaseInput(), p = quickPolicy(q, policy);
  input.title = `${q.identity.brand} ${q.identity.version || q.identity.model} ${q.identity.modelYear}`.slice(0, 160);
  Object.assign(input, { plate: q.plate, source: q.source, identity: q.identity, km: q.km, fipe: q.fipe, askedPriceCents: q.askedPriceCents, inspection: q.inspection, priceMode: q.dealType === "normal" ? "negociavel" : "fixo" });
  input.parameters = { targetCents: p.targetCents, monthlyCapitalRate: p.monthlyCapitalRate, proportionalRate: p.proportionalRate, holdingDailyCents: p.holdingDailyCents, slackCents: p.slackCents, stepCents: p.stepCents };
  input.resaleCents = Object.fromEntries(SCENARIO_KEYS.map(key => [key, q.fipe ? Number(BigInt(q.fipe.valueCents) * BigInt(Math.floor(p.scenarios[key].resaleFactor * 100_000_000)) / BigInt(100_000_000)) : null])) as PurchaseInput["resaleCents"];
  input.resaleEvidence = { source: "Hipótese: FIPE × fatores da política provisória; não é venda observada.", date: new Date().toISOString().slice(0, 10), verified: false };
  // Custos de IA substituem a categoria do perfil; extras entram uma única vez.
  input.costs = [...p.defaultCostItems.map(c => items.find(item => item.key === c.key) ?? { ...c, upfront: c.upfront ?? !["garantia", "contingencia"].includes(c.key) }), ...items.filter(c => !p.defaultCostItems.some(base => base.key === c.key))];
  return input;
}
export function quickFromStored(input: PurchaseInput, quick?: QuickPurchase): QuickPurchase {
  return quick ?? { ...newQuickPurchase(), plate: input.plate, source: input.source, identity: input.identity, km: input.km, fipe: input.fipe, askedPriceCents: input.askedPriceCents, dealType: input.priceMode === "negociavel" ? "normal" : "sem_oferta", inspection: ["aprovado", "reprovado"].includes(input.inspection) ? input.inspection as QuickPurchase["inspection"] : "nao_feito" };
}
