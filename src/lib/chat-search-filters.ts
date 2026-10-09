/** Only explicit units/ranges count: an engine, year or km is never a price. */
export function chatSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function withoutChatMetrics(value: string) {
  return chatSearchText(value)
    .replace(/\b\d[\d.,]*\s*(?:mil|k)?\s*(?:km|quilometros?)\b/g, " ")
    .replace(/\b(?:ano\s*)?(?:19|20)\d{2}\b/g, " ");
}

export type ChatSearchRanges = {
  minYear?: number;
  maxYear?: number;
  maxKm?: number;
  minPrice?: number;
};

export function parseChatNumberAmount(value: string, unit?: string) {
  const n = Number(value.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
  return n * (unit ? 1000 : 1);
}

export function parseChatSearchRanges(value: string): ChatSearchRanges {
  const text = chatSearchText(value);
  const ranges: ChatSearchRanges = {};
  const yearRange = text.match(
    /\b(?:de|entre)\s+((?:19|20)\d{2})\s+(?:a|ate|e)\s+((?:19|20)\d{2})\b/,
  );
  const minYear = text.match(
    /\b(?:a partir de|desde|ano minimo(?: de)?|de)\s+((?:19|20)\d{2})(?:\s+(?:em diante|pra cima))?\b/,
  );
  const maxYear = text.match(
    /\b(?:ate|ano maximo(?: de)?)\s+((?:19|20)\d{2})\b/,
  );
  const exactYear = text.match(/\b(?:ano|modelo)\s+((?:19|20)\d{2})\b/);
  if (yearRange) {
    ranges.minYear = Number(yearRange[1]);
    ranges.maxYear = Number(yearRange[2]);
  } else {
    if (minYear) ranges.minYear = Number(minYear[1]);
    if (maxYear) ranges.maxYear = Number(maxYear[1]);
    if (!minYear && !maxYear && exactYear)
      ranges.minYear = ranges.maxYear = Number(exactYear[1]);
  }
  const km = text.match(
    /\b(?:ate|menos de|no maximo|maximo(?: de)?|abaixo de)\s+([\d.,]+)\s*(mil|k)?\s*(?:km|quilometros?)\b/,
  );
  if (km) {
    const n = parseChatNumberAmount(km[1]!, km[2]);
    if (n >= 0 && n <= 2_000_000) ranges.maxKm = n;
  }
  const price =
    withoutChatMetrics(text).match(
      /\b(?:a partir de|acima de)\s+(?:r\$\s*)?([\d.,]+)\s*(mil|k)?\b/,
    ) ??
    withoutChatMetrics(text).match(
      /\b(?:entre|de)\s+(?:r\$\s*)?([\d.,]+)\s*(mil|k)?\s+(?:a|ate|e)\s+(?:r\$\s*)?[\d.,]+/,
    );
  if (price) {
    let n = parseChatNumberAmount(price[1]!, price[2]);
    if (n < 1000) n *= 1000;
    if (n >= 8000 && n <= 2_000_000) ranges.minPrice = n;
  }
  return ranges;
}

export function chatSearchOrder(value: string): "km" | "year" | null {
  const text = chatSearchText(value);
  if (/\b(menos km|menor km|menos rodad[oa]|menor quilometragem)\b/.test(text))
    return "km";
  if (/\b(mais nov[oa]s?|mais recente|ano mais novo)\b/.test(text))
    return "year";
  return null;
}

export function parseChatSearchCity(
  value: string,
): "aracruz" | "vitoria" | "serra" | "linhares" | null {
  const match = chatSearchText(value).match(
    /\b(?:em|na|de)\s+(aracruz|vitoria|serra|linhares)\b/,
  );
  return match
    ? (match[1] as "aracruz" | "vitoria" | "serra" | "linhares")
    : null;
}

export function chatSearchResets(value: string) {
  const text = chatSearchText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return {
    price:
      /\b(sem limite de preco|sem teto|qualquer preco|sem orcamento)\b/.test(
        text,
      ) || /\bsem limite\b(?! de (?:ano|km))/.test(text),
    gear: /\b(qualquer cambio|tanto faz o cambio|manual ou automatico|automatico ou manual)\b/.test(
      text,
    ),
    city: /\b(qualquer cidade|tanto faz a cidade)\b/.test(text),
    year: /\b(qualquer ano|sem limite de ano)\b/.test(text),
    km: /\b(qualquer km|sem limite de km|tanto faz a km)\b/.test(text),
  };
}
