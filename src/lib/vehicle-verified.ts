/**
 * Informações verificadas daquele exemplar (revisões, pneus, interior, lataria,
 * documentação). Só o que a loja preencheu aparece na ficha: nada é completado
 * com texto automático, e a vistoria genérica de `vehicle-conditions.ts` não
 * entra aqui.
 */

export const VERIFIED_TOPICS = [
  {
    key: "manutencao",
    label: "Revisões e manutenção",
    placeholder: "Ex.: Revisão aos 58 mil km na concessionária, com notas",
  },
  {
    key: "pneus",
    label: "Pneus",
    placeholder: "Ex.: 4 pneus Pirelli trocados em 2025",
  },
  {
    key: "interior",
    label: "Interior",
    motoLabel: "Banco e acabamento",
    placeholder: "Ex.: Bancos sem rasgos, volante sem desgaste",
  },
  {
    key: "lataria",
    label: "Lataria e pintura",
    motoLabel: "Carenagem e pintura",
    placeholder: "Ex.: Pequeno risco no para-choque traseiro",
  },
  {
    key: "documentacao",
    label: "Documentação e vistoria",
    placeholder: "Ex.: IPVA 2026 pago, sem multas, vistoria cautelar aprovada",
  },
] as const;

export type VerifiedTopicKey = (typeof VERIFIED_TOPICS)[number]["key"];

export const VERIFIED_TEXT_MAX = 200;
export const VERIFIED_PHOTOS_PER_TOPIC = 2;

export type VerifiedItem = {
  key: VerifiedTopicKey;
  text: string;
  /** Ids de fotos que o veículo já tem; ids que sumiram são ignorados na ficha. */
  photoIds: string[];
};

export type PublicVerifiedPhoto = {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
};

export type PublicVerifiedItem = {
  key: VerifiedTopicKey;
  label: string;
  text: string;
  photos: PublicVerifiedPhoto[];
};

const TOPIC_KEYS: ReadonlySet<string> = new Set(
  VERIFIED_TOPICS.map((topic) => topic.key),
);

export function isVerifiedTopicKey(value: unknown): value is VerifiedTopicKey {
  return typeof value === "string" && TOPIC_KEYS.has(value);
}

export function verifiedTopicLabel(key: VerifiedTopicKey, isMoto = false) {
  const topic = VERIFIED_TOPICS.find((item) => item.key === key);
  if (!topic) return key;
  return isMoto && "motoLabel" in topic ? topic.motoLabel : topic.label;
}

export function verifiedHeading(isMoto = false) {
  return isMoto ? "Verificado nesta moto" : "Verificado neste carro";
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, VERIFIED_TEXT_MAX);
}

function cleanPhotoIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (id && !ids.includes(id)) ids.push(id);
    if (ids.length >= VERIFIED_PHOTOS_PER_TOPIC) break;
  }
  return ids;
}

/**
 * Lê o JSON salvo no banco sem confiar nele. Item sem texto some (foto
 * sozinha não diz nada), chave desconhecida ou repetida some, e a ordem
 * é sempre a dos tópicos.
 */
export function parseVerifiedItems(raw: unknown): VerifiedItem[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<VerifiedTopicKey, VerifiedItem>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { key, text, photoIds } = entry as Record<string, unknown>;
    if (!isVerifiedTopicKey(key) || byKey.has(key)) continue;
    const clean = cleanText(text);
    if (!clean) continue;
    byKey.set(key, { key, text: clean, photoIds: cleanPhotoIds(photoIds) });
  }
  return VERIFIED_TOPICS.flatMap((topic) => {
    const item = byKey.get(topic.key);
    return item ? [item] : [];
  });
}

export type VerifiedDraft = {
  key: string;
  text: string;
  photoIds: string[];
};

export type VerifiedSanitizeResult =
  | { ok: true; items: VerifiedItem[] }
  | { ok: false; message: string };

/**
 * Valida o que veio do formulário do admin. Foto sem texto no mesmo ponto é
 * erro (o admin corrige), e foto que não é deste veículo nunca é aceita.
 */
export function sanitizeVerifiedDrafts(
  drafts: VerifiedDraft[],
  vehiclePhotoIds: ReadonlySet<string>,
  isMoto = false,
): VerifiedSanitizeResult {
  const items: VerifiedItem[] = [];
  for (const draft of drafts) {
    if (!isVerifiedTopicKey(draft.key)) {
      return { ok: false, message: "Ponto desconhecido." };
    }
    const label = verifiedTopicLabel(draft.key, isMoto);
    const rawText = typeof draft.text === "string" ? draft.text : "";
    const text = cleanText(rawText);
    const photoIds = cleanPhotoIds(draft.photoIds);
    if (rawText.replace(/\s+/g, " ").trim().length > VERIFIED_TEXT_MAX) {
      return {
        ok: false,
        message: `${label}: use até ${VERIFIED_TEXT_MAX} caracteres.`,
      };
    }
    if (!text) {
      if (photoIds.length > 0) {
        return {
          ok: false,
          message: `${label}: escreva uma frase ou tire as fotos.`,
        };
      }
      continue;
    }
    if (photoIds.some((id) => !vehiclePhotoIds.has(id))) {
      return { ok: false, message: `${label}: foto não é deste veículo.` };
    }
    items.push({ key: draft.key, text, photoIds });
  }
  return { ok: true, items: parseVerifiedItems(items) };
}

/**
 * Monta o que a ficha mostra. Só o que foi preenchido; fotos que o veículo
 * não tem mais são descartadas sem derrubar o texto.
 */
export function publicVerifiedItems(
  items: readonly VerifiedItem[],
  photos: readonly PublicVerifiedPhoto[],
  isMoto = false,
): PublicVerifiedItem[] {
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));
  return parseVerifiedItems(items).map((item) => ({
    key: item.key,
    label: verifiedTopicLabel(item.key, isMoto),
    text: item.text,
    photos: item.photoIds.flatMap((id) => {
      const photo = photoById.get(id);
      return photo ? [photo] : [];
    }),
  }));
}
