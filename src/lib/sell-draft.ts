export const SELL_DRAFT_KEY = "garagem:vender:rascunho:v1";
export const SELL_DRAFT_TTL = 24 * 60 * 60 * 1000;
const limits = { name: 120, phone: 30, brand: 80, model: 120, year: 10, plate: 15, km: 30, notes: 2000 } as const;
export type SellDraftFields = Record<keyof typeof limits, string>;

export function sellDraftFields(input: Record<string, unknown>): SellDraftFields {
  return Object.fromEntries(Object.entries(limits).map(([key, limit]) => [key,
    Object.hasOwn(input, key) && typeof input[key] === "string" ? input[key].slice(0, limit) : "",
  ])) as SellDraftFields;
}

/** Apenas texto: nunca fotos, referências privadas, placa consultada ou vínculo de troca. */
export function serializeSellDraft(fields: SellDraftFields, now = Date.now()) {
  const safe = sellDraftFields(fields);
  return Object.values(safe).some(value => value.trim()) ? JSON.stringify({ version: 1, savedAt: now, fields: safe }) : null;
}

export function parseSellDraft(raw: string | null, now = Date.now()): SellDraftFields | null {
  if (!raw || raw.length > 12000) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Number.isFinite(data.savedAt) || data.savedAt > now || now - data.savedAt >= SELL_DRAFT_TTL || !data.fields || typeof data.fields !== "object" || Array.isArray(data.fields)) return null;
    const fields = sellDraftFields(data.fields);
    return Object.values(fields).some(value => value.trim()) ? fields : null;
  } catch { return null; }
}
