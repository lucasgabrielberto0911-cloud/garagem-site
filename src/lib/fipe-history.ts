import { MAX_CENTS, PurchaseError } from "./purchase-input";

export const FIPE_HISTORY_PROVIDER = "tabelafipe.info";
export const FIPE_PARSER_VERSION = "1.0.0";
export const FIPE_HISTORY_BASE = "https://api.tabelafipe.info/api/v1";
export type FipeIdentity = { code: string; modelYear: number; expectedFuel: string; versionLabel: string; transmission: string; confirmed: boolean; fuelDecision: string };
export type FipePoint = { referenceMonth: string; valueCents: number };
export type FipeSnapshot = {
  provider: string; code: string; modelYear: number; fuelRaw: string; fuelNormalized: string;
  brand: string; model: string; referenceMonth: string; valueCents: number; fetchedAt: string;
  sourceUrl: string; warnings: string[]; history: FipePoint[]; parserVersion: string;
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PurchaseError("Resposta FIPE inválida.", 503);
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 250) throw new PurchaseError("Texto FIPE inválido.", 503);
  return value.trim();
}
export function parseFipeCents(value: unknown): number {
  if (typeof value !== "number" && !(typeof value === "string" && /^\d+$/.test(value))) throw new PurchaseError("Preço FIPE inválido.", 503);
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_CENTS) throw new PurchaseError("Preço FIPE fora do limite.", 503);
  return amount;
}
export function parseReferenceMonth(value: unknown): string {
  if (typeof value !== "string") throw new PurchaseError("Mês FIPE inválido.", 503);
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  if (/^\d{4}-(0[1-9]|1[0-2])-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value) return value.slice(0, 7);
  throw new PurchaseError("Referência FIPE deve ser AAAA-MM ou ISO válido.", 503);
}
export const normalizeFuel = (value: string): string => ({ gasolina: "gasolina", álcool: "alcool", alcool: "alcool", etanol: "alcool", flex: "flex", diesel: "diesel", elétrico: "eletrico", eletrico: "eletrico", híbrido: "hibrido", hibrido: "hibrido" }[value.toLowerCase().trim()] ?? "desconhecido");
export function validateFipeIdentity(i: FipeIdentity) {
  if (!/^\d{6}-\d$/.test(i.code) || !Number.isInteger(i.modelYear) || i.modelYear < 1950 || i.modelYear > new Date().getUTCFullYear() + 1 || !i.confirmed || !i.versionLabel?.trim() || i.versionLabel.length > 250 || !i.transmission?.trim() || i.transmission.length > 40 || !i.expectedFuel || i.expectedFuel.length > 40 || typeof i.fuelDecision !== "string" || i.fuelDecision.length > 500) throw new PurchaseError("Confirme versão, ano-modelo, combustível e câmbio. Match não confirma identidade.");
}
export function parseFipeCandidates(raw: unknown) {
  const body = object(raw);
  if (!Array.isArray(body.candidatos) || body.candidatos.length > 10) throw new PurchaseError("Candidatos FIPE inválidos.", 503);
  return body.candidatos.map(value => {
    const c = object(value), code = string(c.codigo_fipe);
    if (!/^\d{6}-\d$/.test(code) || typeof c.ano !== "number" || !Number.isInteger(c.ano) || c.ano < 1950 || c.ano > new Date().getUTCFullYear() + 1 || c.zero_km === true || typeof c.score !== "number" || !Number.isFinite(c.score) || c.score < 0 || c.score > 1) throw new PurchaseError("Identidade do candidato FIPE inválida.", 503);
    return { code, brand: string(c.marca), model: string(c.modelo), modelYear: c.ano, fuel: string(c.combustivel), valueCents: parseFipeCents(c.valor_centavos), score: c.score };
  });
}
export function parseFipeSnapshot(raw: unknown, identity: FipeIdentity, fetchedAt = new Date().toISOString()): FipeSnapshot {
  validateFipeIdentity(identity);
  const body = object(raw), current = object(body.atual);
  if (body.codigo_fipe !== identity.code || current.codigo_fipe !== identity.code || current.model_year !== identity.modelYear || current.model_name !== identity.versionLabel) throw new PurchaseError("A ficha FIPE diverge da versão/ano confirmados. Revise a seleção.");
  const fuelRaw = string(current.fuel_name), fuelNormalized = normalizeFuel(fuelRaw), model = string(current.model_name);
  const warnings: string[] = [];
  if (fuelNormalized === "desconhecido" || fuelNormalized !== normalizeFuel(identity.expectedFuel) || (/flex/i.test(model) && fuelNormalized !== "flex")) {
    warnings.push(`Combustível divergente: provedor declarou “${fuelRaw}”; veículo “${identity.expectedFuel}”; versão “${model}”. Decisão humana: ${identity.fuelDecision || "pendente"}.`);
    if (!identity.fuelDecision.trim()) throw new PurchaseError("Combustível divergente. Registre a decisão de normalização antes de usar a FIPE.");
  }
  if (!Array.isArray(body.historico) || body.historico.length > 60) throw new PurchaseError("Histórico FIPE inválido.", 503);
  const referenceMonth = parseReferenceMonth(current.periodo), valueCents = parseFipeCents(current.value_cents);
  const months = new Map<string, number>();
  for (const row of [...body.historico, current]) {
    const point = object(row);
    if (point.codigo_fipe !== identity.code || point.model_year !== identity.modelYear || point.fuel_name !== fuelRaw || point.model_name !== model) throw new PurchaseError("Série FIPE mistura identidades/combustíveis.", 503);
    const month = parseReferenceMonth(point.periodo), price = parseFipeCents(point.value_cents);
    if (month > referenceMonth || (months.has(month) && months.get(month) !== price)) throw new PurchaseError("Histórico FIPE tem preços conflitantes ou mês futuro.", 503);
    months.set(month, price);
  }
  const history = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, price]) => ({ referenceMonth: month, valueCents: price }));
  for (let index = 1; index < history.length; index++) if (monthIndex(history[index].referenceMonth) - monthIndex(history[index - 1].referenceMonth) !== 1) warnings.push(`Lacuna entre ${history[index - 1].referenceMonth} e ${history[index].referenceMonth}.`);
  return { provider: FIPE_HISTORY_PROVIDER, code: identity.code, modelYear: identity.modelYear, fuelRaw, fuelNormalized, brand: string(current.brand_name), model, referenceMonth, valueCents, fetchedAt, sourceUrl: `${FIPE_HISTORY_BASE}/fipe/${identity.code}?ano=${identity.modelYear}`, warnings, history, parserVersion: FIPE_PARSER_VERSION };
}
function monthIndex(month: string) { const [year, m] = month.split("-").map(Number); return year * 12 + m - 1; }
export function fipeVariation(snapshot: Pick<FipeSnapshot, "history" | "referenceMonth" | "valueCents">, months: number) {
  const target = monthIndex(snapshot.referenceMonth) - months;
  const point = snapshot.history.find(p => monthIndex(p.referenceMonth) === target);
  return point ? { months, change: snapshot.valueCents / point.valueCents - 1, monthlyRate: (snapshot.valueCents / point.valueCents) ** (1 / months) - 1 } : null;
}
