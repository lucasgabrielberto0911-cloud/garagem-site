import { createHash } from "node:crypto";
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
const cache = new Map<string, { expires: number; promise: Promise<PlateResult> }>();
export async function lookupPurchasePlate(raw: unknown): Promise<PlateResult> {
  const plate = normalizePurchasePlate(raw), key = createHash("sha256").update(plate).digest("hex"), now = Date.now();
  const previous = cache.get(key);
  if (previous && previous.expires > now) return previous.promise;
  for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  const promise = (async () => {
    try {
      const response = await fetch(`https://placafipe.com/placa/${plate}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000), headers: { Accept: "text/html" } });
      if (response.status === 404) throw new PurchaseError("Placa não encontrada. Preencha marca, modelo e ano.", 404);
      if (response.status === 429) throw new PurchaseError("Limite da consulta de placa. Aguarde e tente novamente.", 429, Math.min(300, Math.max(1, Number(response.headers.get("Retry-After")) || 60)));
      if (!response.ok) throw new PurchaseError("Consulta de placa indisponível. Preencha marca, modelo e ano.", 503);
      return parsePurchasePlate(await response.text());
    } catch (error) { throw error instanceof PurchaseError ? error : new PurchaseError("Consulta de placa excedeu o prazo ou falhou. Preencha marca, modelo e ano.", 503); }
  })();
  // Cache privado por instância: sucesso por cinco minutos, falha por um minuto.
  cache.set(key, { expires: now + 300_000, promise });
  promise.catch(() => { const row = cache.get(key); if (row?.promise === promise) row.expires = Date.now() + 60_000; });
  return promise;
}
