import { createHash, randomUUID } from "node:crypto";
import { PurchaseError } from "./purchase-input";

export function normalizePurchasePlate(value: unknown): string {
  if (typeof value !== "string") throw new PurchaseError("Informe uma placa brasileira válida.");
  const plate = value.toUpperCase().replace(/[-\s]/g, "");
  if (!/^[A-Z]{3}(?:\d{4}|\d[A-Z]\d{2})$/.test(plate)) throw new PurchaseError("Informe uma placa brasileira válida.");
  return plate;
}
const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, " ").trim();
/** Lê somente identidade e códigos FIPE; descarta documentos e demais dados da página. */
export function parsePurchasePlate(html: string) {
  if (html.length > 500_000) throw new PurchaseError("Resposta de placa inválida.", 503);
  const fields = new Map<string, string>(), foundCodes = new Set<string>();
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => plain(m[1]));
    if (/^\d{6}-\d$/.test(cells[0] ?? "")) foundCodes.add(cells[0]);
    if (cells.length >= 2) fields.set(cells[0].replace(/:$/, "").toLowerCase(), cells[1]);
  }
  const brand = fields.get("marca") ?? "", model = fields.get("genérico") || fields.get("modelo") || "";
  const year = fields.get("ano modelo") || fields.get("ano-modelo") || fields.get("ano") || "";
  const modelYear = Number(year.match(/\b(?:19|20)\d{2}\b/g)?.at(-1));
  if (!brand || brand.length > 80 || !model || model.length > 120 || !Number.isInteger(modelYear) || modelYear < 1950 || modelYear > new Date().getUTCFullYear() + 1) throw new PurchaseError("Não foi possível identificar o veículo. Preencha marca, modelo e ano.", 503);
  const codes = [...foundCodes].slice(0, 10);
  return { brand, model, modelYear, version: fields.get("modelo") ?? model, fuel: (fields.get("combustível") ?? "").slice(0, 40), transmission: "", confirmed: false, codes };
}
type PlateResult = ReturnType<typeof parsePurchasePlate>;

const PLATE_API_URL = "https://consultadeplaca.net/api/v1/lookups";
const FIPE_CODE = /^\d{6}-\d$/;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const asRecord = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

/**
 * Lê só identidade e códigos FIPE da consulta básica da API (consultadeplaca.net).
 * Descarta cidade, UF, cor, roubo/furto e valores: o avaliador não usa nem guarda esses dados.
 */
export function parsePurchasePlateApi(body: unknown): PlateResult {
  const lookup = asRecord(body);
  if (!lookup || lookup.object !== "lookup") throw new PurchaseError("Resposta de placa inválida.", 503);
  if (lookup.result === "not_found") throw new PurchaseError("Placa não encontrada. Preencha marca, modelo e ano.", 404);
  const vehicle = asRecord(lookup.vehicle);
  if (lookup.status !== "completed" || lookup.result !== "found" || !vehicle) throw new PurchaseError("Consulta de placa indisponível. Preencha marca, modelo e ano.", 503);
  const brand = clean(vehicle.brand, 80), model = clean(vehicle.model, 120), version = clean(vehicle.version, 120) || model, modelYear = Number(vehicle.model_year);
  if (!brand || !model || !Number.isInteger(modelYear) || modelYear < 1950 || modelYear > new Date().getUTCFullYear() + 1) throw new PurchaseError("Não foi possível identificar o veículo. Preencha marca, modelo e ano.", 503);
  const fipe = asRecord(vehicle.fipe), versions = Array.isArray(fipe?.versions) ? fipe.versions : [];
  const codes = [...new Set([fipe?.code, ...versions.map((item) => asRecord(item)?.code)].filter((code): code is string => typeof code === "string" && FIPE_CODE.test(code)))].slice(0, 10);
  return { brand, model, modelYear, version, fuel: clean(vehicle.fuel, 40), transmission: "", confirmed: false, codes };
}

/** Falhas de chave, conta ou saldo viram 503 com texto claro; nunca repassam 401/403 ao navegador do painel. */
async function fetchPlateApi(plate: string, apiKey: string): Promise<PlateResult> {
  let response: Response;
  try {
    response = await fetch(PLATE_API_URL, { method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify({ plate }) });
  } catch { throw new PurchaseError("Consulta de placa excedeu o prazo ou falhou. Preencha marca, modelo e ano.", 503); }
  if (response.status === 429) throw new PurchaseError("Limite da consulta de placa. Aguarde e tente novamente.", 429, Math.min(300, Math.max(1, Number(response.headers.get("Retry-After")) || 60)));
  if ([401, 402, 403].includes(response.status)) console.warn("[compra-placa]", { status: response.status });
  if (response.status === 401 || response.status === 403) throw new PurchaseError("A consulta de placa não está autorizada (chave ou conta). Avise o responsável e preencha marca, modelo e ano.", 503);
  if (response.status === 402) throw new PurchaseError("Saldo ou limite diário da consulta de placa esgotado. Preencha marca, modelo e ano.", 503);
  if (response.status === 422) throw new PurchaseError("Placa inválida. Confira e tente de novo.", 400);
  if (!response.ok) throw new PurchaseError("Consulta de placa indisponível. Preencha marca, modelo e ano.", 503);
  let body: unknown;
  try {
    const raw = await response.text();
    if (raw.length > 200_000) throw new Error("grande demais");
    body = JSON.parse(raw);
  } catch { throw new PurchaseError("Resposta de placa inválida.", 503); }
  return parsePurchasePlateApi(body);
}

/** Reserva sem token: a página pública costuma responder 403 do Cloudflare para o servidor. */
async function fetchPlateHtml(plate: string): Promise<PlateResult> {
  const response = await fetch(`https://placafipe.com/placa/${plate}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000), headers: { Accept: "text/html" } });
  if (response.status === 404) throw new PurchaseError("Placa não encontrada. Preencha marca, modelo e ano.", 404);
  if (response.status === 429) throw new PurchaseError("Limite da consulta de placa. Aguarde e tente novamente.", 429, Math.min(300, Math.max(1, Number(response.headers.get("Retry-After")) || 60)));
  if (response.status === 403) throw new PurchaseError("Consulta de placa não configurada: falta a chave CONSULTA_PLACA_API_KEY. Preencha marca, modelo e ano.", 503);
  if (!response.ok) throw new PurchaseError("Consulta de placa indisponível. Preencha marca, modelo e ano.", 503);
  return parsePurchasePlate(await response.text());
}
const cache = new Map<string, { expires: number; promise: Promise<PlateResult> }>();
export async function lookupPurchasePlate(raw: unknown): Promise<PlateResult> {
  const plate = normalizePurchasePlate(raw), key = createHash("sha256").update(plate).digest("hex"), now = Date.now();
  const previous = cache.get(key);
  if (previous && previous.expires > now) return previous.promise;
  for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  const promise = (async () => {
    try {
      const apiKey = process.env.CONSULTA_PLACA_API_KEY?.trim();
      return apiKey ? await fetchPlateApi(plate, apiKey) : await fetchPlateHtml(plate);
    } catch (error) { throw error instanceof PurchaseError ? error : new PurchaseError("Consulta de placa excedeu o prazo ou falhou. Preencha marca, modelo e ano.", 503); }
  })();
  // Cache privado por instância: sucesso por cinco minutos, falha por um minuto.
  cache.set(key, { expires: now + 300_000, promise });
  promise.catch(() => { const row = cache.get(key); if (row?.promise === promise) row.expires = Date.now() + 60_000; });
  return promise;
}
