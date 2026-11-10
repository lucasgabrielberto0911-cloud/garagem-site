import { DEFAULT_PURCHASE_POLICY, SCENARIO_KEYS, type CostItem, type PurchasePolicy, type ScenarioKey } from "./purchase-policy";

export const CONDITION_KEYS = ["mecanica", "pneus", "lataria", "interior", "revisao", "documentacao"] as const;
export type ConditionState = "verificado" | "orcado" | "grave" | "desconhecido" | "nao_se_aplica";
export type Presence = "verificado" | "ausente" | "desconhecido";
export type PurchaseInput = {
  schemaVersion: 1;
  title: string;
  plate: string;
  source: null | { kind: "vehicle" | "lead"; id: string };
  identity: { brand: string; model: string; version: string; modelYear: number | null; fuel: string; transmission: string; confirmed: boolean };
  km: number | null;
  region: string;
  askedPriceCents: number;
  sourceAdPriceCents: number | null;
  intendedAdPriceCents: number | null;
  priceMode: "fixo" | "negociavel";
  resaleBasis: "future_direct";
  /** Venda efetiva na data de cada cenário; não descontar negociação/desvalorização outra vez. */
  resaleCents: Record<ScenarioKey, number | null>;
  resaleEvidence: { source: string; date: string; verified: boolean };
  costs: CostItem[];
  conditions: Record<typeof CONDITION_KEYS[number], { state: ConditionState; note: string }>;
  inspection: "desconhecido" | "nao_feito" | "pendente" | "aprovado" | "apontamentos" | "reprovado";
  inspectionVerified: boolean;
  inspectionNote: string;
  restriction: "desconhecido" | "nao_verificado" | "resolvida" | "grave";
  manual: Presence;
  spareKey: Presence;
  maintenanceHistory: Presence;
  liquidity: { days: number | null; sampleCount: number | null; effectiveSampleSize: number | null; source: string; date: string; verified: boolean };
  fipe: null | { provider: "manual" | "tabelafipe.info"; code: string; referenceMonth: string; valueCents: number; source: string; fuelDecision: string };
  parameters: Pick<PurchasePolicy, "targetCents" | "monthlyCapitalRate" | "proportionalRate" | "holdingDailyCents" | "slackCents" | "stepCents">;
};

export class PurchaseError extends Error {
  constructor(message: string, public status = 422, public retryAfter?: number) { super(message); }
}
export const MAX_CENTS = 2_000_000_000;
export function cents(value: unknown, label = "Valor", minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > MAX_CENTS) throw new PurchaseError(`${label}: informe centavos inteiros válidos.`);
  return value;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PurchaseError("Estrutura da avaliação inválida.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 500): string {
  if (typeof value !== "string" || value.length > max) throw new PurchaseError("Texto ausente ou longo demais.");
  return value.trim();
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new PurchaseError("Confirmação inválida.");
  return value;
}
function option<T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T)) throw new PurchaseError("Opção inválida na avaliação.");
  return value as T;
}
function date(value: unknown): string {
  const s = text(value, 10);
  if (s && (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s || s > new Date().toISOString().slice(0, 10))) throw new PurchaseError("Data de evidência inválida ou futura.");
  return s;
}
export function parseCost(value: unknown): CostItem {
  const c = record(value);
  const status = option(c.status, ["ok", "estimado", "desconhecido", "nao_se_aplica", "incluido"] as const);
  const result: CostItem = { key: text(c.key, 60), label: text(c.label, 100), status, note: text(c.note ?? ""), date: date(c.date ?? ""), source: option(c.source ?? "premissa", ["orcamento", "historico", "premissa"] as const), fromProfile: boolean(c.fromProfile ?? false), upfront: boolean(c.upfront ?? true) };
  if (!result.key || !result.label) throw new PurchaseError("Identifique cada custo.");
  if (c.conditionKey != null) result.conditionKey = option(c.conditionKey, CONDITION_KEYS);
  if (result.source !== "premissa" && (!result.note || !result.date)) throw new PurchaseError(`${result.label}: orçamento ou histórico exige fonte na justificativa e data.`);
  if (status === "ok" || status === "estimado") {
    result.baseCents = cents(c.baseCents, result.label);
    result.minCents = status === "ok" ? result.baseCents : cents(c.minCents, result.label);
    result.maxCents = status === "ok" ? result.baseCents : cents(c.maxCents, result.label);
    if (result.minCents > result.baseCents || result.baseCents > result.maxCents) throw new PurchaseError(`${result.label}: use mínimo ≤ base ≤ máximo.`);
    if (result.baseCents === 0 && !result.note) throw new PurchaseError(`${result.label}: justifique o custo zero.`);
  }
  if (["nao_se_aplica", "incluido"].includes(status) && !result.note) throw new PurchaseError(`${result.label}: justifique a ausência ou indique onde o custo está incluído.`);
  return result;
}

/** Copia somente campos autorizados; totais, notas e políticas do navegador são descartados. */
export function parsePurchaseInput(value: unknown): PurchaseInput {
  const p = record(value), i = record(p.identity), r = record(p.resaleCents), evidence = record(p.resaleEvidence), liq = record(p.liquidity), cond = record(p.conditions), params = record(p.parameters);
  if (p.schemaVersion !== 1 || p.resaleBasis !== "future_direct") throw new PurchaseError("Versão de entrada não suportada.");
  const title = text(p.title, 160);
  if (!title) throw new PurchaseError("Informe a descrição do veículo.");
  const plate = text(p.plate, 10).toUpperCase().replace(/[-\s]/g, "");
  if (plate && !/^[A-Z]{3}(?:\d{4}|\d[A-Z]\d{2})$/.test(plate)) throw new PurchaseError("Placa brasileira inválida.");
  const modelYear = i.modelYear === null ? null : cents(i.modelYear, "Ano-modelo", 1950);
  if (modelYear !== null && modelYear > new Date().getUTCFullYear() + 1) throw new PurchaseError("Ano-modelo inválido; zero km fora deste fluxo.");
  const identity = { brand: text(i.brand, 80), model: text(i.model, 120), version: text(i.version, 160), modelYear, fuel: text(i.fuel, 40), transmission: text(i.transmission, 40), confirmed: boolean(i.confirmed) };
  if (identity.confirmed && (!identity.brand || !identity.model || !identity.version || !modelYear || !identity.fuel || !identity.transmission)) throw new PurchaseError("Complete versão, ano, combustível e câmbio antes de confirmar a identidade.");
  if (!Array.isArray(p.costs) || p.costs.length > 40) throw new PurchaseError("Informe até 40 custos.");
  const costs = p.costs.map(parseCost);
  if (new Set(costs.map(c => c.key)).size !== costs.length || DEFAULT_PURCHASE_POLICY.defaultCostItems.some(c => !costs.some(item => item.key === c.key))) throw new PurchaseError("Revise os custos obrigatórios; não apague categorias desconhecidas.");
  const conditions = Object.fromEntries(CONDITION_KEYS.map(k => {
    const c = record(cond[k]);
    const state = option(c.state, ["verificado", "orcado", "grave", "desconhecido", "nao_se_aplica"] as const), note = text(c.note);
    if (state !== "desconhecido" && !note) throw new PurchaseError(`Registre a evidência de ${k}.`);
    if (state === "orcado" && !costs.some(item => (item.key === k || item.conditionKey === k) && ["ok", "estimado"].includes(item.status) && item.source === "orcamento")) throw new PurchaseError(`${k}: registre o orçamento na categoria de custo correspondente.`);
    return [k, { state, note }];
  })) as PurchaseInput["conditions"];
  const parameters = { targetCents: cents(params.targetCents, "Meta", 1), monthlyCapitalRate: Number(params.monthlyCapitalRate), proportionalRate: Number(params.proportionalRate), holdingDailyCents: cents(params.holdingDailyCents), slackCents: cents(params.slackCents), stepCents: cents(params.stepCents, "Passo de oferta", 1) };
  for (const key of ["monthlyCapitalRate", "proportionalRate"] as const) if (typeof params[key] !== "number" || !Number.isFinite(parameters[key]) || parameters[key] < 0 || parameters[key] >= 1) throw new PurchaseError("Taxas devem estar entre 0 e 100%, sem incluir 100%.");
  const result: PurchaseInput = {
    schemaVersion: 1, title, plate, source: null, identity, km: p.km === null ? null : cents(p.km, "Quilometragem"), region: text(p.region, 100),
    askedPriceCents: cents(p.askedPriceCents, "Preço pedido", 1), sourceAdPriceCents: p.sourceAdPriceCents === null ? null : cents(p.sourceAdPriceCents), intendedAdPriceCents: p.intendedAdPriceCents === null ? null : cents(p.intendedAdPriceCents),
    priceMode: option(p.priceMode, ["fixo", "negociavel"] as const), resaleBasis: "future_direct",
    resaleCents: Object.fromEntries(SCENARIO_KEYS.map(k => [k, r[k] === null ? null : cents(r[k], "Revenda", 1)])) as PurchaseInput["resaleCents"],
    resaleEvidence: { source: text(evidence.source, 1000), date: date(evidence.date), verified: boolean(evidence.verified) }, costs, conditions,
    inspection: option(p.inspection, ["desconhecido", "nao_feito", "pendente", "aprovado", "apontamentos", "reprovado"] as const), inspectionVerified: boolean(p.inspectionVerified), inspectionNote: text(p.inspectionNote),
    restriction: option(p.restriction, ["desconhecido", "nao_verificado", "resolvida", "grave"] as const),
    manual: option(p.manual, ["verificado", "ausente", "desconhecido"] as const), spareKey: option(p.spareKey, ["verificado", "ausente", "desconhecido"] as const), maintenanceHistory: option(p.maintenanceHistory, ["verificado", "ausente", "desconhecido"] as const),
    liquidity: { days: liq.days === null ? null : cents(liq.days, "Dias de giro", 1), sampleCount: liq.sampleCount == null ? null : cents(liq.sampleCount, "Tamanho da amostra", 1), effectiveSampleSize: liq.effectiveSampleSize == null ? null : Number(liq.effectiveSampleSize), source: text(liq.source, 1000), date: date(liq.date), verified: boolean(liq.verified) }, fipe: null, parameters,
  };
  if ((result.inspectionVerified || result.restriction === "resolvida") && !result.inspectionNote) throw new PurchaseError("Descreva a evidência documental e sua verificação.");
  if (result.liquidity.effectiveSampleSize !== null && (typeof liq.effectiveSampleSize !== "number" || !Number.isFinite(result.liquidity.effectiveSampleSize) || result.liquidity.effectiveSampleSize <= 0 || result.liquidity.effectiveSampleSize > (result.liquidity.sampleCount ?? 0))) throw new PurchaseError("Amostra efetiva deve ser positiva e não exceder o número de vendas.");
  if ((result.resaleEvidence.verified && (!result.resaleEvidence.source || !result.resaleEvidence.date)) || (result.liquidity.verified && (!result.liquidity.source || !result.liquidity.date || !result.liquidity.days))) throw new PurchaseError("Evidência verificada exige fonte, data e valor.");
  if (p.source != null) {
    const source = record(p.source), id = text(source.id, 100);
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new PurchaseError("Origem interna inválida.");
    result.source = { kind: option(source.kind, ["vehicle", "lead"] as const), id };
  }
  if (p.fipe !== null) {
    const f = record(p.fipe), referenceMonth = text(f.referenceMonth, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth) || referenceMonth > new Date().toISOString().slice(0, 7)) throw new PurchaseError("Referência FIPE deve ser AAAA-MM, sem mês futuro.");
    result.fipe = { provider: option(f.provider, ["manual", "tabelafipe.info"] as const), code: text(f.code, 8), referenceMonth, valueCents: cents(f.valueCents, "FIPE", 1), source: text(f.source, 1000), fuelDecision: text(f.fuelDecision) };
    if (!result.fipe.source) throw new PurchaseError("Informe a origem da FIPE.");
  }
  return result;
}

export function newPurchaseInput(): PurchaseInput {
  const p = DEFAULT_PURCHASE_POLICY;
  return { schemaVersion: 1, title: "", plate: "", source: null, identity: { brand: "", model: "", version: "", modelYear: null, fuel: "", transmission: "", confirmed: false }, km: null, region: "Linhares/ES", askedPriceCents: 0, sourceAdPriceCents: null, intendedAdPriceCents: null, priceMode: "fixo", resaleBasis: "future_direct", resaleCents: { rapida: null, normal: null, demorada: null }, resaleEvidence: { source: "", date: "", verified: false }, costs: p.defaultCostItems.map(c => ({ ...c, upfront: !["garantia", "contingencia"].includes(c.key) })), conditions: Object.fromEntries(CONDITION_KEYS.map(k => [k, { state: "desconhecido", note: "" }])) as PurchaseInput["conditions"], inspection: "desconhecido", inspectionVerified: false, inspectionNote: "", restriction: "desconhecido", manual: "desconhecido", spareKey: "desconhecido", maintenanceHistory: "desconhecido", liquidity: { days: null, sampleCount: null, effectiveSampleSize: null, source: "", date: "", verified: false }, fipe: null, parameters: { targetCents: p.targetCents, monthlyCapitalRate: p.monthlyCapitalRate, proportionalRate: p.proportionalRate, holdingDailyCents: p.holdingDailyCents, slackCents: p.slackCents, stepCents: p.stepCents } };
}
