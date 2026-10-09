export const WANTED_DRAFT_KEY = "garagem:pedido:rascunho:v1";
export const WANTED_DRAFT_TTL = 24 * 60 * 60 * 1000;
const limits = { model: 120, name: 120, email: 254, phone: 30, yearMin: 4, yearMax: 4, priceMin: 30, priceMax: 30, kmMin: 30, kmMax: 30 } as const;
export type WantedDraftFields = Record<keyof typeof limits, string>;

export function wantedDraftFields(input: Record<string, unknown>): WantedDraftFields {
  return Object.fromEntries(Object.entries(limits).map(([key, limit]) => [key,
    Object.hasOwn(input, key) && typeof input[key] === "string" ? input[key].slice(0, limit) : "",
  ])) as WantedDraftFields;
}

/** Não guarda consentimento, campos internos ou vínculo com um anúncio. */
export function serializeWantedDraft(fields: WantedDraftFields, context: string, now = Date.now()) {
  const safe = wantedDraftFields(fields);
  return Object.values(safe).some(value => value.trim())
    ? JSON.stringify({ version: 1, savedAt: now, context, fields: safe }) : null;
}

export function parseWantedDraft(raw: string | null, context: string, now = Date.now()): WantedDraftFields | null {
  if (!raw || raw.length > 10000) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1 || data.context !== context || !Number.isFinite(data.savedAt) || data.savedAt > now || now - data.savedAt >= WANTED_DRAFT_TTL || !data.fields || typeof data.fields !== "object" || Array.isArray(data.fields)) return null;
    const fields = wantedDraftFields(data.fields);
    return Object.values(fields).some(value => value.trim()) ? fields : null;
  } catch { return null; }
}
